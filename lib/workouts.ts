import { and, eq, sql, TransactionRollbackError } from "drizzle-orm";
import { db } from "@/db";
import { workoutBlocks, workoutItems, workouts, workoutTags } from "@/db/schema";
import type { ValidatedBuilderPayload } from "./workout-builder-validation";
import type { WorkoutListFilters } from "./workouts-filters";
import type { ValidatedWorkoutInput } from "./workouts-validation";

/** The transaction handle db.transaction()'s callback receives — used to
 * type helpers that run inside a transaction but aren't themselves the
 * top-level db.transaction() call. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Lists a user's workouts, most recently created first, each with its
 * tags nested (joined through workout_tags — see getWorkoutForUser's
 * comment on why that's a join table and not an array column).
 * `userId` is a required parameter — not read from a session internally —
 * so every call site is forced to supply it explicitly. Since RLS is
 * disabled on this database, that filter is the only thing preventing one
 * user from reading another user's workouts; it must never be dropped.
 *
 * `filters` (see WorkoutListFilters in lib/workouts-filters.ts) is
 * optional and every field within it — other than `sort`, which always has
 * a value — is independently optional; only the conditions for fields
 * actually present are added to the WHERE clause, so the query never
 * fetches the full table and filters in application code. Different filter
 * kinds combine with AND (e.g. difficulty + a tag both apply); `tagIds`
 * itself combines with OR — a workout matches if it has ANY of the given
 * tags, via a `workouts.id IN (SELECT workout_id FROM workout_tags WHERE
 * tag_id IN (...))` subquery, since with eleven tags in the catalog
 * requiring ALL of them would return nothing in most combinations.
 *
 * `filters.sort` picks the ORDER BY: "newest"/"oldest" by created_at,
 * "title" alphabetically (case-insensitive), "updated" by updated_at
 * descending. Every option ends with `id` as a tiebreaker so two rows
 * sharing a timestamp still sort the same way on every load.
 */
export async function getWorkoutsForUser(
  userId: string,
  filters: WorkoutListFilters = { sort: "newest" }
) {
  return db.query.workouts.findMany({
    where: (workouts, { and, eq, ilike, inArray }) =>
      and(
        eq(workouts.userId, userId),
        filters.q ? ilike(workouts.title, `%${filters.q}%`) : undefined,
        filters.primaryType
          ? eq(workouts.primaryType, filters.primaryType)
          : undefined,
        filters.difficulty
          ? eq(workouts.difficulty, filters.difficulty)
          : undefined,
        filters.favoritesOnly ? eq(workouts.isFavorite, true) : undefined,
        filters.tagIds && filters.tagIds.length > 0
          ? inArray(
              workouts.id,
              db
                .select({ workoutId: workoutTags.workoutId })
                .from(workoutTags)
                .where(inArray(workoutTags.tagId, filters.tagIds))
            )
          : undefined
      ),
    orderBy: (workouts, { asc, desc, sql }) => {
      switch (filters.sort) {
        case "oldest":
          return [asc(workouts.createdAt), asc(workouts.id)];
        case "title":
          return [asc(sql`lower(${workouts.title})`), asc(workouts.id)];
        case "updated":
          return [desc(workouts.updatedAt), asc(workouts.id)];
        case "newest":
        default:
          return [desc(workouts.createdAt), asc(workouts.id)];
      }
    },
    with: {
      workoutTags: {
        with: { tag: true },
      },
    },
  });
}

/**
 * Fetches a single workout owned by `userId`, with its blocks, items, and
 * tags nested — blocks ordered by sort_order, items within each block
 * ordered by sort_order, each item's linked exercise included. Tags come
 * back as `workoutTags`, an array of the workout_tags join rows with each
 * row's `tag` nested; workout_tags exists as a table (rather than an array
 * column on workouts) specifically so a tag deletion can cascade instead
 * of leaving a dangling id behind. Returns null both when the id doesn't
 * exist and when it belongs to a different user, so callers can't
 * distinguish "not found" from "not yours".
 */
export async function getWorkoutForUser(id: string, userId: string) {
  const workout = await db.query.workouts.findFirst({
    where: (workouts, { and, eq }) =>
      and(eq(workouts.id, id), eq(workouts.userId, userId)),
    with: {
      blocks: {
        orderBy: (blocks, { asc }) => [asc(blocks.sortOrder)],
        with: {
          items: {
            orderBy: (items, { asc }) => [asc(items.sortOrder)],
            with: {
              exercise: true,
            },
          },
        },
      },
      workoutTags: {
        with: { tag: true },
      },
    },
  });

  return workout ?? null;
}

/**
 * Creates a workout owned by `userId` from already-validated input (see
 * validateWorkoutInput in lib/workouts-validation.ts) and returns the
 * created row. `userId` is a required parameter rather than being taken
 * from `input`, so it can never come from client-supplied data.
 */
export async function createWorkoutForUser(
  userId: string,
  input: ValidatedWorkoutInput
) {
  const [created] = await db
    .insert(workouts)
    .values({
      userId,
      title: input.title,
      description: input.description,
      primaryType: input.primaryType,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
    })
    .returning();

  return created;
}

/**
 * Updates a workout owned by `userId` from already-validated input (same
 * shape as createWorkoutForUser) and returns the updated row, or null if
 * nothing matched. The ownership check is part of the UPDATE's WHERE
 * clause itself — not a separate read followed by a write — so there is
 * no window in which a check and the mutation could apply to different
 * rows. Returns null both when the id doesn't exist and when it belongs
 * to a different user.
 */
export async function updateWorkoutForUser(
  id: string,
  userId: string,
  input: ValidatedWorkoutInput
) {
  const [updated] = await db
    .update(workouts)
    .set({
      title: input.title,
      description: input.description,
      primaryType: input.primaryType,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
    })
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Deletes a workout owned by `userId`, returning true if a row was
 * deleted and false otherwise — whether because the id doesn't exist or
 * because it belongs to a different user. The ownership check is part of
 * the DELETE's WHERE clause itself, not a separate read followed by a
 * write. Blocks and items cascade with the workout (ON DELETE CASCADE on
 * their FKs); any workout_sessions referencing it have workout_id set to
 * null (ON DELETE SET NULL) and keep their own snapshot fields, so
 * training history survives the delete.
 */
export async function deleteWorkoutForUser(id: string, userId: string) {
  const deleted = await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });

  return deleted.length > 0;
}

/**
 * Creates a full workout — the workout row, its blocks, and each
 * block's items — from an already-validated builder payload (see
 * validateBuilderPayload in lib/workouts-validation.ts). sort_order for
 * both blocks and items is assigned here from array position; the
 * client never sends a sort_order, and client-side ids
 * (crypto.randomUUID()) are never sent to the database, which generates
 * its own. Everything runs inside a single db.transaction() so a
 * failure partway through (e.g. a foreign-key violation on one item)
 * rolls back the whole tree instead of leaving a partial workout
 * behind. Returns the created workout row.
 */
/**
 * Inserts a builder payload's blocks and items under an already-created
 * (or already-cleared) workout, inside an existing transaction. sort_order
 * for both blocks and items is assigned here from array position; the
 * client never sends a sort_order, and client-side ids
 * (crypto.randomUUID()) are never sent to the database, which generates
 * its own. Shared by createFullWorkoutForUser (fresh workout) and
 * updateFullWorkoutForUser (after deleting the workout's existing blocks)
 * so the insert logic exists in exactly one place.
 */
async function insertBlocksAndItems(
  tx: Transaction,
  workoutId: string,
  blocks: ValidatedBuilderPayload["blocks"]
) {
  for (const [blockIndex, block] of blocks.entries()) {
    const [createdBlock] = await tx
      .insert(workoutBlocks)
      .values({
        workoutId,
        title: block.title,
        sortOrder: blockIndex,
        blockType: block.blockType,
        durationSeconds: block.durationSeconds,
        rounds: block.rounds,
        workSeconds: block.workSeconds,
        restSeconds: block.restSeconds,
        intervalSeconds: block.intervalSeconds,
      })
      .returning({ id: workoutBlocks.id });

    if (block.items.length === 0) {
      continue;
    }

    await tx.insert(workoutItems).values(
      block.items.map((item, itemIndex) => ({
        blockId: createdBlock.id,
        sortOrder: itemIndex,
        exerciseId: item.exerciseId,
        customName: item.customName,
        sets: item.sets,
        volumeType: item.volumeType,
        volumeValue:
          item.volumeValue != null ? String(item.volumeValue) : null,
        targetType: item.targetType,
        targetValue:
          item.targetValue != null ? String(item.targetValue) : null,
        targetPreset: item.targetPreset,
        weightKg: item.weightKg != null ? String(item.weightKg) : null,
        restSeconds: item.restSeconds,
        notes: item.notes,
      }))
    );
  }
}

/**
 * Inserts workout_tags rows linking `workoutId` to `tagIds`, inside an
 * existing transaction. A no-op for an empty array. Shared by
 * createFullWorkoutForUser (fresh workout) and updateFullWorkoutForUser
 * (after deleting the workout's existing tag links), mirroring how
 * insertBlocksAndItems is shared between the two for the block/item tree.
 */
async function insertWorkoutTagLinks(
  tx: Transaction,
  workoutId: string,
  tagIds: ValidatedBuilderPayload["tagIds"]
) {
  if (tagIds.length === 0) {
    return;
  }

  await tx
    .insert(workoutTags)
    .values(tagIds.map((tagId) => ({ workoutId, tagId })));
}

/**
 * Creates a full workout — the workout row, its blocks, each block's
 * items, and its tag links — from an already-validated builder payload
 * (see validateBuilderPayload in lib/workout-builder-validation.ts).
 * Everything runs inside a single db.transaction() so a failure partway
 * through (e.g. a foreign-key violation on one item, or on an unknown tag
 * id) rolls back the whole tree instead of leaving a partial workout
 * behind. Returns the created workout row.
 */
export async function createFullWorkoutForUser(
  userId: string,
  payload: ValidatedBuilderPayload
) {
  return db.transaction(async (tx) => {
    const [createdWorkout] = await tx
      .insert(workouts)
      .values({
        userId,
        title: payload.title,
        description: payload.description,
        primaryType: payload.primaryType,
        difficulty: payload.difficulty,
        estimatedDurationMinutes: payload.estimatedDurationMinutes,
      })
      .returning();

    await insertBlocksAndItems(tx, createdWorkout.id, payload.blocks);
    await insertWorkoutTagLinks(tx, createdWorkout.id, payload.tagIds);

    return createdWorkout;
  });
}

/**
 * Replaces a full workout owned by `userId` — its own fields, plus its
 * entire block/item tree and its tag links — from an already-validated
 * builder payload. Blocks and items have no identity that anything else
 * references (workout_sessions references workouts, not blocks — see
 * GOHYBRID_PLAN.md §6), so rather than diffing the existing tree against
 * the new one, every existing block is deleted (items cascade via their
 * block_id FK) and the submitted tree is re-inserted with sort_order from
 * array position, exactly as createFullWorkoutForUser does for a new
 * workout. Tag links are replaced the same way: every existing
 * workout_tags row for this workout is deleted and the submitted tag ids
 * are re-inserted, rather than diffed.
 *
 * The workout row's own UPDATE has the ownership check
 * (`WHERE id = ... AND user_id = ...`) built into its WHERE clause. If
 * nothing matches — the id doesn't exist or belongs to a different user —
 * the transaction is rolled back before any block is touched, and this
 * function returns null; the caller can't tell those two cases apart,
 * matching updateWorkoutForUser's contract. Everything else runs in the
 * same transaction, so a failure at any point (including the ownership
 * check) leaves the original workout, blocks, items, and tag links
 * completely unchanged.
 */
export async function updateFullWorkoutForUser(
  id: string,
  userId: string,
  payload: ValidatedBuilderPayload
) {
  try {
    return await db.transaction(async (tx) => {
      const [updatedWorkout] = await tx
        .update(workouts)
        .set({
          title: payload.title,
          description: payload.description,
          primaryType: payload.primaryType,
          difficulty: payload.difficulty,
          estimatedDurationMinutes: payload.estimatedDurationMinutes,
        })
        .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
        .returning();

      if (!updatedWorkout) {
        tx.rollback();
      }

      await tx.delete(workoutBlocks).where(eq(workoutBlocks.workoutId, id));
      await insertBlocksAndItems(tx, id, payload.blocks);

      await tx.delete(workoutTags).where(eq(workoutTags.workoutId, id));
      await insertWorkoutTagLinks(tx, id, payload.tagIds);

      return updatedWorkout;
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) {
      return null;
    }
    throw error;
  }
}

/**
 * Flips is_favorite for a workout owned by `userId` in a single UPDATE —
 * the new value is computed in SQL (`NOT is_favorite`) rather than read
 * first and written back, so two concurrent toggles can't race each
 * other into landing on the same value. Returns the new value, or null
 * if nothing matched (the id doesn't exist or belongs to a different
 * user).
 */
export async function toggleFavoriteForUser(id: string, userId: string) {
  const [updated] = await db
    .update(workouts)
    .set({ isFavorite: sql`not ${workouts.isFavorite}` })
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .returning({ isFavorite: workouts.isFavorite });

  return updated?.isFavorite ?? null;
}

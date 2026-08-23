import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { workoutBlocks, workoutItems, workouts } from "@/db/schema";
import type { ValidatedBuilderPayload } from "./workout-builder-validation";
import type { ValidatedWorkoutInput } from "./workouts-validation";

/**
 * Lists a user's workouts, most recently created first. `userId` is a
 * required parameter — not read from a session internally — so every
 * call site is forced to supply it explicitly. Since RLS is disabled on
 * this database, that filter is the only thing preventing one user from
 * reading another user's workouts; it must never be dropped.
 */
export async function getWorkoutsForUser(userId: string) {
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.createdAt));
}

/**
 * Fetches a single workout owned by `userId`, with its blocks and items
 * nested — blocks ordered by sort_order, items within each block ordered
 * by sort_order, each item's linked exercise included. Returns null both
 * when the id doesn't exist and when it belongs to a different user, so
 * callers can't distinguish "not found" from "not yours".
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

    for (const [blockIndex, block] of payload.blocks.entries()) {
      const [createdBlock] = await tx
        .insert(workoutBlocks)
        .values({
          workoutId: createdWorkout.id,
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

    return createdWorkout;
  });
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

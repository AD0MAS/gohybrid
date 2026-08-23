import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workouts } from "@/db/schema";
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

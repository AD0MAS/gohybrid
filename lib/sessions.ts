import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workoutSessions, workouts } from "@/db/schema";

/**
 * Creates a workout_session recording that `userId` completed one of their
 * workouts "now". Reads the workout's current title and primary_type and
 * copies them onto the session as snapshot columns (workout_title,
 * workout_primary_type) — see GOHYBRID_PLAN.md §6/§7 — so training history
 * keeps showing the workout as it was at completion time even if the
 * template is later edited or deleted. Returns null if the workout doesn't
 * exist or isn't owned by `userId`, in which case no session is created.
 */
export async function createSessionForWorkout(
  userId: string,
  workoutId: string
) {
  const [workout] = await db
    .select({
      id: workouts.id,
      title: workouts.title,
      primaryType: workouts.primaryType,
    })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));

  if (!workout) {
    return null;
  }

  const [created] = await db
    .insert(workoutSessions)
    .values({
      userId,
      workoutId: workout.id,
      workoutTitle: workout.title,
      workoutPrimaryType: workout.primaryType,
    })
    .returning();

  return created;
}

/**
 * Lists a user's completed workout sessions, most recently completed
 * first, for the Training History page. Reads only the session's own
 * columns — including its workout_title/workout_primary_type snapshots —
 * never joining against `workouts`, so a session whose workout was since
 * deleted (workout_id set to null) still renders correctly.
 */
export async function getSessionsForUser(userId: string) {
  return db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.completedAt));
}

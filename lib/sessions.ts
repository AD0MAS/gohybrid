import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workoutSessions, workouts } from "@/db/schema";
import {
  linkScheduledWorkoutForDateToSession,
  linkScheduledWorkoutToSession,
} from "./scheduled-workouts";

/**
 * Which scheduled_workouts entry, if any, to link the new session to — see
 * linkScheduledWorkoutForDateToSession/linkScheduledWorkoutToSession in
 * lib/scheduled-workouts.ts for what each search does and why both exist.
 * `sameDay` is for callers that only know a workout and a calendar day
 * (finishWorkout); `specific` is for markScheduledWorkoutDone, which
 * already holds the exact entry the user clicked.
 */
export type SessionLinkTarget =
  | { kind: "sameDay"; date: string }
  | { kind: "specific"; scheduledWorkoutId: string };

/**
 * Creates a workout_session recording that `userId` completed one of their
 * workouts. Reads the workout's current title and primary_type and copies
 * them onto the session as snapshot columns (workout_title,
 * workout_primary_type) — see GOHYBRID_PLAN.md §6/§7 — so training history
 * keeps showing the workout as it was at completion time even if the
 * template is later edited or deleted. Returns null if the workout doesn't
 * exist or isn't owned by `userId`, in which case no session is created.
 *
 * `completedAt`, if omitted, leaves the column to its DB default
 * (`now()`) — the common case of finishing a workout as it happens
 * (finishWorkout). The backdating caller (markScheduledWorkoutDone) passes
 * an explicit instant instead (see toNoonInstant in lib/timezone.ts), so a
 * workout recorded as done on an earlier day lands in that day's heatmap
 * cell and streak, not today's.
 *
 * `link` decides which scheduled_workouts entry (if any) to attach the new
 * session to, in the same transaction as the insert — see
 * SessionLinkTarget above. If nothing matches, this is a no-op and the
 * session simply stands alone, the common case since most workouts are
 * started unscheduled.
 */
export async function createSessionForWorkout(
  userId: string,
  workoutId: string,
  link: SessionLinkTarget,
  completedAt?: Date
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

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(workoutSessions)
      .values({
        userId,
        workoutId: workout.id,
        workoutTitle: workout.title,
        workoutPrimaryType: workout.primaryType,
        ...(completedAt ? { completedAt } : {}),
      })
      .returning();

    if (link.kind === "sameDay") {
      await linkScheduledWorkoutForDateToSession(
        userId,
        workout.id,
        link.date,
        created.id,
        tx
      );
    } else {
      await linkScheduledWorkoutToSession(
        userId,
        link.scheduledWorkoutId,
        created.id,
        tx
      );
    }

    return created;
  });
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

/**
 * Lists a user's most recently completed workout sessions, capped at
 * `limit` — the Home page's recent activity list. Same query and snapshot-
 * column reasoning as getSessionsForUser, just bounded; kept as a separate
 * function rather than an optional parameter so the unbounded Training
 * History query can't accidentally pick up a default cap.
 */
export async function getRecentSessionsForUser(userId: string, limit: number) {
  return db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.completedAt))
    .limit(limit);
}

/**
 * Deletes a workout session owned by `userId`, returning true if a row was
 * deleted and false otherwise — whether because the id doesn't exist or
 * because it belongs to a different user. Ownership is enforced in the
 * WHERE clause, same pattern as deleteBodyMetricForUser/
 * deletePersonalRecordForUser. No cleanup of scheduled_workouts is needed
 * here: scheduled_workouts.session_id is ON DELETE SET NULL (see
 * GOHYBRID_PLAN.md §6A), so a scheduled workout that pointed at this
 * session automatically goes back to Planned.
 */
export async function deleteSessionForUser(
  id: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
    .returning({ id: workoutSessions.id });

  return deleted.length > 0;
}

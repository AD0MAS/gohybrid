import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledWorkouts, workoutSessions, workouts } from "@/db/schema";
import {
  linkScheduledWorkoutForDateToSession,
  linkScheduledWorkoutToSession,
} from "./scheduled-workouts";
import { toCalendarDayInTimezone, toClockTimeInTimezone } from "./timezone";

/**
 * Which scheduled_workouts entry, if any, to link the new session to — see
 * linkScheduledWorkoutForDateToSession/linkScheduledWorkoutToSession in
 * lib/scheduled-workouts.ts for what each search does and why both exist.
 * `sameDay` is for callers that only know a workout and a calendar day
 * (finishWorkout); `specific` is for markScheduledWorkoutDone, which
 * already holds the exact entry the user clicked. `sameDay` also carries
 * `timezone` — see the backfill step in createSessionForWorkout below,
 * which needs it to turn the new session's completedAt into a calendar day
 * and clock time when there was nothing to link to.
 */
export type SessionLinkTarget =
  | { kind: "sameDay"; date: string; timezone: string }
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
 * SessionLinkTarget above. For `specific` (markScheduledWorkoutDone), the
 * entry is already known and this is a no-op if it can't be linked. For
 * `sameDay` (finishWorkout and the sessions API route), when no existing
 * entry matches, a new scheduled_workouts row is inserted instead —
 * is_backfilled true, session_id pointing at the session just created,
 * scheduled_date/scheduled_time derived from completedAt in `link.timezone`
 * — so an unplanned workout still appears on the week strip and calendar as
 * Completed, exactly like a planned one (GOHYBRID_PLAN.md's week-strip/
 * calendar reasoning). The backfill insert happens in the same transaction
 * as the session insert, so a `sameDay` session is never left without one.
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
      const linked = await linkScheduledWorkoutForDateToSession(
        userId,
        workout.id,
        link.date,
        created.id,
        tx
      );

      if (!linked) {
        await tx.insert(scheduledWorkouts).values({
          userId,
          workoutId: workout.id,
          scheduledDate: toCalendarDayInTimezone(
            created.completedAt,
            link.timezone
          ),
          scheduledTime: toClockTimeInTimezone(
            created.completedAt,
            link.timezone
          ),
          sessionId: created.id,
          isBackfilled: true,
        });
      }
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
 * deletePersonalRecordForUser.
 *
 * A user-planned scheduled_workouts entry that pointed at this session needs
 * no cleanup: scheduled_workouts.session_id is ON DELETE SET NULL (see
 * GOHYBRID_PLAN.md §6A), so it automatically goes back to Planned — the plan
 * was deliberate and should survive the session. A *backfilled* entry
 * (is_backfilled true — see createSessionForWorkout) only ever existed to
 * represent this session, so it must disappear with it instead: it's deleted
 * explicitly, in the same transaction, before the session itself — deleting
 * the session first would let ON DELETE SET NULL clear session_id before
 * this query could find the row to remove.
 */
export async function deleteSessionForUser(
  id: string,
  userId: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .delete(scheduledWorkouts)
      .where(
        and(
          eq(scheduledWorkouts.sessionId, id),
          eq(scheduledWorkouts.userId, userId),
          eq(scheduledWorkouts.isBackfilled, true)
        )
      );

    const deleted = await tx
      .delete(workoutSessions)
      .where(
        and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId))
      )
      .returning({ id: workoutSessions.id });

    return deleted.length > 0;
  });
}

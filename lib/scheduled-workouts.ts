import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { scheduledWorkouts, workouts } from "@/db/schema";

/** The transaction handle db.transaction()'s callback receives — used to
 * type helpers that may run inside a transaction started elsewhere (e.g.
 * by createSessionForWorkout) but aren't themselves the top-level
 * db.transaction() call. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

const upcomingScheduledWorkoutQuery = {
  with: {
    workout: {
      with: {
        workoutTags: { with: { tag: true } },
      },
    },
  },
} as const;

/**
 * Returns "today" as a YYYY-MM-DD string, computed in Postgres via
 * `current_date` rather than derived from `new Date()` on the application
 * server — the same ground truth already used by getUpcomingForUser and
 * linkTodaysScheduledWorkoutToSession, so the home page's week strip can't
 * disagree with the database about which day is "today."
 */
export async function getCurrentDateString(): Promise<string> {
  const [row] = await db.execute<{ today: string }>(
    sql`select current_date as today`
  );
  return row.today;
}

/**
 * Schedules one of `userId`'s workouts for `scheduledDate` (a YYYY-MM-DD
 * string), optionally at `scheduledTime` (an HH:MM/HH:MM:SS string, or null
 * for "no specific time" — a normal, common state). Verifies the workout is
 * owned by `userId` before inserting — mirrors createSessionForWorkout's
 * ownership check in lib/sessions.ts — so a forged workoutId belonging to
 * another user can't be scheduled. Returns null if the workout doesn't
 * exist or isn't owned by `userId`, in which case no row is created.
 */
export async function scheduleWorkoutForUser(
  userId: string,
  workoutId: string,
  scheduledDate: string,
  scheduledTime: string | null,
  notes: string | null
) {
  const [workout] = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));

  if (!workout) {
    return null;
  }

  const [created] = await db
    .insert(scheduledWorkouts)
    .values({
      userId,
      workoutId: workout.id,
      scheduledDate,
      scheduledTime,
      notes,
    })
    .returning();

  return created;
}

/**
 * Lists `userId`'s upcoming scheduled workouts — scheduled_date today or
 * later, not skipped, with no session linked yet — soonest first, each
 * with its workout (and that workout's tags) nested. Ordered by date, then
 * (within a day) by scheduled_time — entries with a time before ones
 * without, earliest first, since ASC ordering already sorts NULLs last in
 * Postgres. Used by the Upcoming list on /schedule and the home page.
 * `today` is computed in Postgres via `current_date` rather than passed in
 * from the application server, so it can't drift from the database's own
 * notion of "today."
 */
export async function getUpcomingForUser(userId: string, limit: number) {
  return db.query.scheduledWorkouts.findMany({
    where: (scheduledWorkouts, { and, eq, gte }) =>
      and(
        eq(scheduledWorkouts.userId, userId),
        gte(scheduledWorkouts.scheduledDate, sql`current_date`),
        eq(scheduledWorkouts.isSkipped, false),
        isNull(scheduledWorkouts.sessionId)
      ),
    orderBy: (scheduledWorkouts, { asc }) => [
      asc(scheduledWorkouts.scheduledDate),
      asc(scheduledWorkouts.scheduledTime),
    ],
    limit,
    ...upcomingScheduledWorkoutQuery,
  });
}

/**
 * Lists `userId`'s scheduled workouts with a scheduled_date between `from`
 * and `to` (both YYYY-MM-DD, inclusive), each with its workout (and that
 * workout's tags) nested. A plain date-range query with no filtering
 * beyond ownership — skipped and completed entries are included, and both
 * past and future dates are returned — so the same function serves the
 * home page's week strip and the /calendar month grid, each rendering
 * skipped/completed/planned entries differently. Ordered by date, then
 * (within a day) by scheduled_time — entries with a time before ones
 * without, earliest first (ASC ordering sorts NULLs last in Postgres).
 */
export async function getScheduledForUserInRange(
  userId: string,
  from: string,
  to: string
) {
  return db.query.scheduledWorkouts.findMany({
    where: (scheduledWorkouts, { and, eq, gte, lte }) =>
      and(
        eq(scheduledWorkouts.userId, userId),
        gte(scheduledWorkouts.scheduledDate, from),
        lte(scheduledWorkouts.scheduledDate, to)
      ),
    orderBy: (scheduledWorkouts, { asc }) => [
      asc(scheduledWorkouts.scheduledDate),
      asc(scheduledWorkouts.scheduledTime),
    ],
    ...upcomingScheduledWorkoutQuery,
  });
}

/**
 * Sets is_skipped on a scheduled workout owned by `userId`. The ownership
 * check is part of the UPDATE's WHERE clause itself, not a separate read
 * followed by a write. Returns the updated row, or null if nothing matched
 * (the id doesn't exist or belongs to a different user).
 */
export async function markSkippedForUser(
  id: string,
  userId: string,
  isSkipped: boolean
) {
  const [updated] = await db
    .update(scheduledWorkouts)
    .set({ isSkipped })
    .where(
      and(eq(scheduledWorkouts.id, id), eq(scheduledWorkouts.userId, userId))
    )
    .returning();

  return updated ?? null;
}

/**
 * Deletes a scheduled workout owned by `userId`, returning true if a row
 * was deleted and false otherwise — whether because the id doesn't exist
 * or because it belongs to a different user. The linked workout_session
 * (if any) is untouched: scheduling is a plan pointing at a session, never
 * the other way round, so removing the plan must never remove completed
 * training history.
 */
export async function unscheduleForUser(id: string, userId: string) {
  const deleted = await db
    .delete(scheduledWorkouts)
    .where(
      and(eq(scheduledWorkouts.id, id), eq(scheduledWorkouts.userId, userId))
    )
    .returning({ id: scheduledWorkouts.id });

  return deleted.length > 0;
}

/**
 * Links a newly created workout_session to `userId`'s earliest still-open
 * scheduled_workouts entry for `workoutId` dated today (session_id IS
 * NULL), if one exists — so finishing a scheduled workout marks the plan
 * completed instead of leaving it dangling. Matching is by date only —
 * scheduled_time is informational for the user, never a constraint here, so
 * finishing at 20:30 still links to a plan set for 19:00. "Earliest" breaks
 * ties between same-day entries by scheduled_time first (NULLs last, so a
 * timed entry wins over an untimed one), then by created_at. The candidate
 * row is selected and
 * updated in a single statement (a scalar subquery inside the UPDATE's
 * WHERE, not a read followed by a write) so two concurrent finishes can't
 * both link to the same row. A no-op, returning null, when nothing
 * matches — starting a workout that wasn't scheduled keeps working exactly
 * as before. Accepts an optional transaction handle so
 * createSessionForWorkout can run this in the same transaction as the
 * session insert.
 */
export async function linkTodaysScheduledWorkoutToSession(
  userId: string,
  workoutId: string,
  sessionId: string,
  executor: Executor = db
) {
  const candidate = executor
    .select({ id: scheduledWorkouts.id })
    .from(scheduledWorkouts)
    .where(
      and(
        eq(scheduledWorkouts.userId, userId),
        eq(scheduledWorkouts.workoutId, workoutId),
        eq(scheduledWorkouts.scheduledDate, sql`current_date`),
        isNull(scheduledWorkouts.sessionId)
      )
    )
    .orderBy(asc(scheduledWorkouts.scheduledTime), asc(scheduledWorkouts.createdAt))
    .limit(1);

  const [linked] = await executor
    .update(scheduledWorkouts)
    .set({ sessionId })
    .where(sql`${scheduledWorkouts.id} = (${candidate})`)
    .returning();

  return linked ?? null;
}

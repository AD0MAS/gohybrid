import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { scheduledWorkouts, workoutSessions, workouts } from "@/db/schema";

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
 * Postgres. Used by the UpcomingList component, rendered on /workouts and
 * the home page.
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
 * Reads one scheduled workout owned by `userId`, or null if the id doesn't
 * exist or belongs to a different user. Used by markScheduledWorkoutDone
 * (app/(app)/upcoming-actions.ts) to resolve the entry's workoutId,
 * scheduledDate and current sessionId before creating a session for it —
 * same ownership-in-WHERE-clause pattern as markSkippedForUser/
 * unscheduleForUser, just a read instead of a write.
 */
export async function getScheduledWorkoutForUser(id: string, userId: string) {
  const [row] = await db
    .select({
      id: scheduledWorkouts.id,
      workoutId: scheduledWorkouts.workoutId,
      scheduledDate: scheduledWorkouts.scheduledDate,
      sessionId: scheduledWorkouts.sessionId,
    })
    .from(scheduledWorkouts)
    .where(
      and(eq(scheduledWorkouts.id, id), eq(scheduledWorkouts.userId, userId))
    );

  return row ?? null;
}

/**
 * Deletes a scheduled workout owned by `userId`, and — if it was linked to
 * a session (session_id NOT NULL, i.e. Completed) — deletes that
 * workout_session too, so removing a completed entry doesn't leave an
 * orphaned session in training history. Ownership is enforced in every
 * statement's own WHERE clause, so a non-owned or nonexistent id deletes
 * nothing and returns false silently, rather than throwing — a forged id
 * is never confirmed to exist.
 */
export async function unscheduleForUser(
  id: string,
  userId: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select({ sessionId: scheduledWorkouts.sessionId })
      .from(scheduledWorkouts)
      .where(
        and(eq(scheduledWorkouts.id, id), eq(scheduledWorkouts.userId, userId))
      );

    if (!entry) {
      return false;
    }

    await tx
      .delete(scheduledWorkouts)
      .where(
        and(eq(scheduledWorkouts.id, id), eq(scheduledWorkouts.userId, userId))
      );

    if (entry.sessionId) {
      await tx
        .delete(workoutSessions)
        .where(
          and(
            eq(workoutSessions.id, entry.sessionId),
            eq(workoutSessions.userId, userId)
          )
        );
    }

    return true;
  });
}

/**
 * Links a newly created workout_session to `userId`'s earliest still-open
 * scheduled_workouts entry for `workoutId` dated `date` (a YYYY-MM-DD
 * string, session_id IS NULL), if one exists — so finishing a scheduled
 * workout marks the plan completed instead of leaving it dangling.
 * Matching is by date only — scheduled_time is informational for the user,
 * never a constraint here, so finishing at 20:30 still links to a plan set
 * for 19:00. "Earliest" breaks ties between same-day entries by
 * scheduled_time first (NULLs last, so a timed entry wins over an untimed
 * one), then by created_at. The candidate row is selected and updated in a
 * single statement (a scalar subquery inside the UPDATE's WHERE, not a read
 * followed by a write) so two concurrent finishes can't both link to the
 * same row. A no-op, returning null, when nothing matches — starting a
 * workout that wasn't scheduled keeps working exactly as before. Accepts an
 * optional transaction handle so createSessionForWorkout can run this in
 * the same transaction as the session insert.
 *
 * `date` is a required parameter, not Postgres's `current_date` — the
 * caller (finishWorkout) resolves "which day" from the user's own
 * getUserContext first, same reasoning as every other "what day is it"
 * read in this codebase (lib/user-settings.ts). Used when the caller only
 * knows a workout and a day, not a specific scheduled_workouts id; see
 * linkScheduledWorkoutToSession below for the case where it does.
 */
export async function linkScheduledWorkoutForDateToSession(
  userId: string,
  workoutId: string,
  date: string,
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
        eq(scheduledWorkouts.scheduledDate, date),
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

/**
 * Links a newly created workout_session directly to one specific scheduled
 * workout owned by `userId`, ownership enforced in the UPDATE's WHERE
 * clause. Used by markScheduledWorkoutDone (app/(app)/upcoming-actions.ts),
 * which already holds the exact scheduled_workouts id the user clicked —
 * unlike linkScheduledWorkoutForDateToSession's same-day search, there's no
 * ambiguity to break a tie on here, so a plain conditional UPDATE is enough
 * (still race-free: two concurrent "mark done" clicks on the same id just
 * both succeed idempotently). Accepts an optional transaction handle for
 * the same reason linkScheduledWorkoutForDateToSession does.
 */
export async function linkScheduledWorkoutToSession(
  userId: string,
  scheduledWorkoutId: string,
  sessionId: string,
  executor: Executor = db
) {
  const [linked] = await executor
    .update(scheduledWorkouts)
    .set({ sessionId })
    .where(
      and(
        eq(scheduledWorkouts.id, scheduledWorkoutId),
        eq(scheduledWorkouts.userId, userId)
      )
    )
    .returning();

  return linked ?? null;
}

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { workoutPrimaryTypeEnum, workoutSessions } from "@/db/schema";
import { diffInDays } from "./dates";

export type DailySessionCount = {
  /** YYYY-MM-DD, the calendar day in the query's timezone. */
  date: string;
  count: number;
};

/**
 * Per-day session counts for `userId` between `from` and `to` (both
 * YYYY-MM-DD, inclusive) — the activity heatmap's data source. One GROUP BY
 * query; rows are never fetched and counted in application code.
 *
 * `completed_at` is a `timestamptz` (an instant), but the heatmap groups by
 * calendar day, so the instant is converted to a day with `AT TIME ZONE
 * timezone` inside the query itself — never by deriving a day from a
 * JavaScript Date. A session completed at 23:30 in the user's timezone is
 * already the next day in UTC and must still land on the day it was
 * experienced as.
 *
 * Days with no sessions are absent from the result, not present with count
 * 0 — callers treat a missing date as 0.
 *
 * `timezone` is the caller's own — see getUserSettings in
 * lib/user-settings.ts, which falls back to APP_TIMEZONE (lib/timezone.ts)
 * for a user with no saved settings — rather than a module-level constant,
 * so each user's heatmap buckets by the calendar day they actually
 * experienced, not a fixed one.
 */
export async function getDailySessionCountsForUser(
  userId: string,
  from: string,
  to: string,
  timezone: string
): Promise<DailySessionCount[]> {
  const rows = await db.execute<{ date: string; count: number }>(sql`
    select
      (${workoutSessions.completedAt} at time zone ${timezone})::date::text as date,
      count(*)::int as count
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
      and (${workoutSessions.completedAt} at time zone ${timezone})::date
        between ${from}::date and ${to}::date
    group by date
    order by date
  `);

  return rows.map((row) => ({ date: row.date, count: row.count }));
}

/**
 * Total completed sessions for `userId`, all time — the /stats summary
 * card. A single count(*), so there's nothing to bucket or zero-fill.
 */
export async function getTotalSessionCountForUser(
  userId: string
): Promise<number> {
  const [row] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
  `);

  return row.count;
}

/**
 * Completed sessions for `userId` between `from` and `to` (both
 * YYYY-MM-DD, inclusive), converting `completed_at` to a calendar day the
 * same way getDailySessionCountsForUser does. Used for the /stats "this
 * week" and "this month" summary cards, where the range is exactly the
 * current week or month and only the total is needed. `timezone` is the
 * caller's own, same reasoning as getDailySessionCountsForUser.
 */
export async function getSessionCountForUserInRange(
  userId: string,
  from: string,
  to: string,
  timezone: string
): Promise<number> {
  const [row] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
      and (${workoutSessions.completedAt} at time zone ${timezone})::date
        between ${from}::date and ${to}::date
  `);

  return row.count;
}

export type WeeklySessionCount = {
  /** Monday of the week, YYYY-MM-DD, in the query's timezone. */
  weekStart: string;
  count: number;
};

/**
 * Per-week session counts for `userId` between `from` and `to` (both
 * YYYY-MM-DD, inclusive) — the weekly volume chart's data source. Postgres's
 * `date_trunc('week', …)` is ISO-8601 (Monday-first) regardless of locale,
 * so `weekStart` always agrees with lib/dates.ts's Monday-first convention
 * (getMondayOfWeek, getWeekStartsEndingAt). One GROUP BY query; weeks with
 * no sessions are absent from the result, same "absence means 0" contract
 * as getDailySessionCountsForUser — callers zero-fill with
 * getWeekStartsEndingAt. `timezone` is the caller's own, same reasoning as
 * getDailySessionCountsForUser.
 */
export async function getWeeklySessionCountsForUser(
  userId: string,
  from: string,
  to: string,
  timezone: string
): Promise<WeeklySessionCount[]> {
  const rows = await db.execute<{ week_start: string; count: number }>(sql`
    select
      date_trunc('week', (${workoutSessions.completedAt} at time zone ${timezone}))::date::text as week_start,
      count(*)::int as count
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
      and (${workoutSessions.completedAt} at time zone ${timezone})::date
        between ${from}::date and ${to}::date
    group by week_start
    order by week_start
  `);

  return rows.map((row) => ({ weekStart: row.week_start, count: row.count }));
}

export type MonthlySessionCount = {
  /** YYYY-MM, in the query's timezone. */
  month: string;
  count: number;
};

/**
 * Per-month session counts for `userId` between `from` and `to` (both
 * YYYY-MM-DD, inclusive). Same shape/contract as
 * getWeeklySessionCountsForUser, bucketed by calendar month instead of
 * week; callers zero-fill with getMonthsEndingAt. `timezone` is the
 * caller's own, same reasoning as getDailySessionCountsForUser.
 */
export async function getMonthlySessionCountsForUser(
  userId: string,
  from: string,
  to: string,
  timezone: string
): Promise<MonthlySessionCount[]> {
  const rows = await db.execute<{ month: string; count: number }>(sql`
    select
      to_char(date_trunc('month', (${workoutSessions.completedAt} at time zone ${timezone})), 'YYYY-MM') as month,
      count(*)::int as count
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
      and (${workoutSessions.completedAt} at time zone ${timezone})::date
        between ${from}::date and ${to}::date
    group by month
    order by month
  `);

  return rows.map((row) => ({ month: row.month, count: row.count }));
}

export type PrimaryTypeSessionCount = {
  primaryType: (typeof workoutPrimaryTypeEnum.enumValues)[number];
  count: number;
};

/**
 * Session counts for `userId` grouped by workout_primary_type, over
 * `from`..`to` (both YYYY-MM-DD, inclusive) — the primary-type distribution
 * chart's data source. Only types with at least one session in range are
 * present in the result; the enum deliberately has no "hybrid" value (see
 * GOHYBRID_PLAN.md §5 Layer 3), and this query doesn't invent one. Ordered
 * by count descending so the largest slice of training renders first.
 * `timezone` is the caller's own, same reasoning as
 * getDailySessionCountsForUser.
 */
export async function getSessionCountsByPrimaryTypeForUser(
  userId: string,
  from: string,
  to: string,
  timezone: string
): Promise<PrimaryTypeSessionCount[]> {
  const rows = await db.execute<{
    primary_type: PrimaryTypeSessionCount["primaryType"];
    count: number;
  }>(sql`
    select
      ${workoutSessions.workoutPrimaryType} as primary_type,
      count(*)::int as count
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
      and (${workoutSessions.completedAt} at time zone ${timezone})::date
        between ${from}::date and ${to}::date
    group by primary_type
    order by count desc
  `);

  return rows.map((row) => ({
    primaryType: row.primary_type,
    count: row.count,
  }));
}

export type StreakSummary = {
  /** Consecutive days with a session, ending today or yesterday; 0 if the streak is already broken. */
  current: number;
  /** Longest run of consecutive days with a session, all time. */
  longest: number;
};

/**
 * Current and longest streaks of consecutive calendar days with at least
 * one session, computed from a sorted list of a user's distinct active
 * days (ascending). Pure day-string arithmetic via diffInDays — no
 * timezone or SQL concerns here, that's already resolved by the caller's
 * day query. Exported separately from getStreaksForUser so the run-length
 * logic can be exercised directly (gap handling, month-boundary handling)
 * without a database.
 */
export function computeStreaks(
  sortedDays: string[],
  today: string
): StreakSummary {
  if (sortedDays.length === 0) {
    return { current: 0, longest: 0 };
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    run = diffInDays(sortedDays[i - 1], sortedDays[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const lastActiveDay = sortedDays[sortedDays.length - 1];
  if (diffInDays(lastActiveDay, today) > 1) {
    // Most recent session is more than a day ago — the streak is broken,
    // regardless of how long it ran before the gap.
    return { current: 0, longest };
  }

  let current = 1;
  for (let i = sortedDays.length - 1; i > 0; i--) {
    if (diffInDays(sortedDays[i - 1], sortedDays[i]) !== 1) break;
    current++;
  }

  return { current, longest };
}

/**
 * Current and longest streaks of consecutive days with at least one
 * session, for `userId` — see computeStreaks for the run-length logic.
 * `today` is the caller's ground-truth "today" (see getUserContext in
 * lib/user-settings.ts), not derived from a JavaScript Date here.
 * `timezone` is the caller's own, same reasoning as
 * getDailySessionCountsForUser.
 */
export async function getStreaksForUser(
  userId: string,
  today: string,
  timezone: string
): Promise<StreakSummary> {
  const rows = await db.execute<{ date: string }>(sql`
    select distinct (${workoutSessions.completedAt} at time zone ${timezone})::date::text as date
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
    order by date
  `);

  return computeStreaks(
    rows.map((row) => row.date),
    today
  );
}

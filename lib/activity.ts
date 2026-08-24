import { sql } from "drizzle-orm";
import { db } from "@/db";
import { workoutSessions } from "@/db/schema";
import { APP_TIMEZONE } from "./timezone";

export type DailySessionCount = {
  /** YYYY-MM-DD, the calendar day in APP_TIMEZONE. */
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
 * APP_TIMEZONE` inside the query itself — never by deriving a day from a
 * JavaScript Date. A session completed at 23:30 in Vilnius is already the
 * next day in UTC and must still land on the day it was experienced as.
 *
 * Days with no sessions are absent from the result, not present with count
 * 0 — callers treat a missing date as 0.
 */
export async function getDailySessionCountsForUser(
  userId: string,
  from: string,
  to: string
): Promise<DailySessionCount[]> {
  const rows = await db.execute<{ date: string; count: number }>(sql`
    select
      (${workoutSessions.completedAt} at time zone ${APP_TIMEZONE})::date::text as date,
      count(*)::int as count
    from ${workoutSessions}
    where ${workoutSessions.userId} = ${userId}
      and (${workoutSessions.completedAt} at time zone ${APP_TIMEZONE})::date
        between ${from}::date and ${to}::date
    group by date
    order by date
  `);

  return rows.map((row) => ({ date: row.date, count: row.count }));
}

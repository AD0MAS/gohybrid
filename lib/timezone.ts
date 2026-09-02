import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Fallback timezone for a user with no saved settings — see
 * DEFAULT_USER_SETTINGS in lib/user-settings.ts, the only place that still
 * reads this constant directly. Every `AT TIME ZONE` conversion of a
 * `timestamptz` instant (e.g. workout_sessions.completed_at) to the
 * calendar day it falls on — never by deriving a day from a JavaScript
 * Date, which would use the server's local timezone instead — now takes
 * its timezone as a parameter (lib/activity.ts) rather than importing a
 * module-level constant, so a user's own saved timezone (Layer 4's
 * Settings, see lib/user-settings.ts) reaches those queries instead of
 * this one.
 */
export const APP_TIMEZONE = "Europe/Vilnius";

/**
 * Returns "today" as a YYYY-MM-DD string in `timezone` — computed in
 * Postgres via `now() at time zone timezone`, never derived from a
 * JavaScript Date on the application server, which would use the server's
 * own local timezone instead. `timezone` is required, not defaulted: a
 * call site that forgets to pass one is a compile error, same reasoning as
 * the required `timezone` parameter on the AT TIME ZONE queries in
 * lib/activity.ts — "today" must always be a specific user's calendar day,
 * never an implicit server/UTC one. Moved here from
 * lib/scheduled-workouts.ts, and given this required parameter, once
 * "today" stopped being a single app-wide value (see getUserContext in
 * lib/user-settings.ts, which is how every caller should reach this now).
 */
export async function getCurrentDateString(timezone: string): Promise<string> {
  const [row] = await db.execute<{ today: string }>(
    sql`select (now() at time zone ${timezone})::date::text as today`
  );
  return row.today;
}

/**
 * Converts a calendar day (YYYY-MM-DD) plus a fixed noon wall-clock time to
 * the UTC instant that represents in `timezone` — computed in Postgres by
 * applying `AT TIME ZONE` to a naive timestamp (the same technique
 * getCurrentDateString uses in the other direction), so a backdated session
 * with no recorded time-of-day still lands in the correct calendar-day
 * bucket everywhere completed_at is later read back, whether via `AT TIME
 * ZONE` in SQL (lib/activity.ts) or toCalendarDayInTimezone above. A plain
 * `new Date(\`${date}T12:00:00\`)` would use the application server's own
 * local timezone instead of the user's. Noon rather than midnight: a fixed
 * local wall-clock instant right at a DST transition boundary can be
 * ambiguous (falls twice) or nonexistent (skipped) in some zones, and noon
 * is never inside one, so this is safe for every IANA zone without needing
 * to special-case the transition.
 *
 * Selects the instant as an explicit ISO-8601 UTC string
 * (`to_char(... at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`) rather
 * than the bare `timestamptz` expression, then parses it in JS —
 * `db.execute`'s type parameter is only a compile-time assertion, not a
 * runtime guarantee, and for a raw (non-schema-mapped) query the
 * underlying driver hands back Postgres's own text representation
 * ("2026-08-24 09:00:00+00") rather than a Date, same reasoning every
 * other db.execute query in this codebase already follows by casting to
 * `::text`/`::int` and typing the row as string/number (see
 * getCurrentDateString above and lib/activity.ts) instead of trusting a
 * richer type back from the driver. A raw `new Date(pgTimestampString)`
 * would depend on Node's non-standard leniency for that exact text shape;
 * this format is guaranteed parseable per the ECMA-262 Date Time String
 * Format instead.
 */
export async function toNoonInstant(date: string, timezone: string): Promise<Date> {
  const [row] = await db.execute<{ instant: string }>(
    sql`select to_char(
      ((${date}::date + time '12:00:00') at time zone ${timezone}) at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"'
    ) as instant`
  );
  return new Date(row.instant);
}

/**
 * Converts an already-fetched `timestamptz` instant (e.g. a session's
 * completedAt) to the YYYY-MM-DD calendar day it falls on in `timezone`,
 * entirely in JavaScript via Intl — not `AT TIME ZONE`. The other functions
 * in this file convert inside SQL because they're computing over rows still
 * in the database; here the instant is already an in-memory JS Date from a
 * list the caller fetched for display, and issuing one query per row to
 * re-derive its day would be an N+1 query for what's otherwise a plain
 * render. `Intl.DateTimeFormat`'s IANA timezone database gives the same
 * result Postgres's `AT TIME ZONE` would for the same zone name.
 * `formatToParts` is used instead of a locale-string trick (e.g. "en-CA"
 * happening to format as YYYY-MM-DD) so the result's shape doesn't depend on
 * locale formatting conventions.
 */
export function toCalendarDayInTimezone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const part = (type: "year" | "month" | "day") =>
    parts.find((p) => p.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Converts an already-fetched `timestamptz` instant to an "HH:MM" clock time
 * in `timezone`, same reasoning and formatToParts approach as
 * toCalendarDayInTimezone — a session's completedAt rendered with
 * `.toLocaleTimeString()` would use the server's local timezone (correct in
 * dev, wrong on Vercel's UTC), splitting the day (already timezone-correct
 * via toCalendarDayInTimezone) from the time into two different frames.
 * `hour12: false` so the output shape doesn't depend on the server locale
 * either.
 */
export function toClockTimeInTimezone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(instant);

  const part = (type: "hour" | "minute") =>
    parts.find((p) => p.type === type)?.value;

  return `${part("hour")}:${part("minute")}`;
}

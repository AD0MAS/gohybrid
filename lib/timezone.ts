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

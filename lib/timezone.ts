/**
 * Fixed application timezone, used wherever a `timestamptz` instant (e.g.
 * workout_sessions.completed_at) needs to be converted to the calendar day
 * it falls on — via Postgres's `AT TIME ZONE`, never by deriving a day from
 * a JavaScript Date, which would use the server's local timezone instead.
 * Layer 4's Profile & Settings will make this per-user; until then, every
 * such conversion imports this constant, so it's the one line to change.
 */
export const APP_TIMEZONE = "Europe/Vilnius";

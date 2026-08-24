const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_SHORT_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Weekday initials, Monday first — for the week strip's day cells. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Splits a YYYY-MM-DD string into its numeric parts. No validation — callers
 * only ever pass strings that already round-tripped through Postgres `date`
 * columns or isValidDateString.
 */
function parseDateString(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/**
 * Adds `days` (negative to subtract) to a YYYY-MM-DD string, returning a new
 * YYYY-MM-DD string. Built entirely on Date.UTC and the getUTC* accessors —
 * never the local-timezone-sensitive `new Date(string)` + getDate()/getDay()
 * pair — so the result never depends on the server's local timezone. This is
 * calendar-day arithmetic, not an instant, so no timezone should be involved
 * at all; UTC is used here only as a fixed, always-available frame for the
 * day-counting math, not as "the" timezone of anything.
 */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDateString(date);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  const y = result.getUTCFullYear();
  const m = String(result.getUTCMonth() + 1).padStart(2, "0");
  const d = String(result.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * ISO weekday for a YYYY-MM-DD string: 1 = Monday ... 7 = Sunday. Derived
 * from getUTCDay() (0 = Sunday ... 6 = Saturday), which needs an explicit
 * conversion to land on a Monday-first week.
 */
export function getIsoWeekday(date: string): number {
  const { year, month, day } = parseDateString(date);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/** The Monday of the week containing `date`, as a YYYY-MM-DD string. */
export function getMondayOfWeek(date: string): string {
  return addDays(date, -(getIsoWeekday(date) - 1));
}

/** The day-of-month number (1-31) encoded in a YYYY-MM-DD string. */
export function getDayNumber(date: string): number {
  return parseDateString(date).day;
}

/**
 * Formats a YYYY-MM-DD string as e.g. "Tue 25 August" — the selected day's
 * heading below the week strip.
 */
export function formatDayHeading(date: string): string {
  const { day } = parseDateString(date);
  const weekday = WEEKDAY_SHORT_NAMES[getIsoWeekday(date) - 1];
  const month = MONTH_NAMES[parseDateString(date).month - 1];
  return `${weekday} ${day} ${month}`;
}

/** Formats a YYYY-MM-DD string as e.g. "September 2026". */
export function formatMonthYearHeading(date: string): string {
  const { year, month } = parseDateString(date);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

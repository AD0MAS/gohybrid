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

const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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
 * Splits a YYYY-MM string into its numeric parts. No validation — callers
 * only ever pass strings that already passed isValidMonthString or were
 * derived from getMonthString.
 */
function parseMonthString(month: string): { year: number; month: number } {
  const [year, m] = month.split("-").map(Number);
  return { year, month: m };
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

/**
 * Formats a YYYY-MM-DD string's month as a 3-letter abbreviation, e.g.
 * "Sep" — the activity heatmap's compact month labels.
 */
export function formatMonthShort(date: string): string {
  const { month } = parseDateString(date);
  return MONTH_SHORT_NAMES[month - 1];
}

/**
 * Whole days from `from` to `to` (both YYYY-MM-DD), negative if `to` is
 * earlier. Built on Date.UTC, same as addDays, so the result never depends
 * on the server's local timezone or on DST — there is no DST in UTC, so a
 * millisecond subtraction always lands on a whole number of days here.
 */
export function diffInDays(from: string, to: string): number {
  const a = parseDateString(from);
  const b = parseDateString(to);
  const msPerDay = 24 * 60 * 60 * 1000;
  return (
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
    msPerDay
  );
}

/** Extracts the YYYY-MM prefix from a YYYY-MM-DD date string. */
export function getMonthString(date: string): string {
  return date.slice(0, 7);
}

/**
 * Formats a YYYY-MM-DD string as e.g. "24 Aug" — the weekly stats chart's
 * compact x-axis labels.
 */
export function formatDayMonthShort(date: string): string {
  return `${getDayNumber(date)} ${formatMonthShort(date)}`;
}

/**
 * Monday-anchored week starts ending with the week containing `today`,
 * oldest first, length `count` — the weekly stats chart's x-axis and the
 * bucket keys for getWeeklySessionCountsForUser. Callers zero-fill any
 * bucket absent from that query's result, the same "absence means zero"
 * convention as the activity heatmap.
 */
export function getWeekStartsEndingAt(today: string, count: number): string[] {
  const lastMonday = getMondayOfWeek(today);
  return Array.from({ length: count }, (_, i) =>
    addDays(lastMonday, -(count - 1 - i) * 7)
  );
}

/**
 * YYYY-MM month strings ending with the month containing `today`, oldest
 * first, length `count` — same role as getWeekStartsEndingAt, for
 * getMonthlySessionCountsForUser.
 */
export function getMonthsEndingAt(today: string, count: number): string[] {
  const currentMonth = getMonthString(today);
  return Array.from({ length: count }, (_, i) =>
    addMonths(currentMonth, -(count - 1 - i))
  );
}

/** The first day of `month` (YYYY-MM) as a YYYY-MM-DD string. */
export function getFirstDayOfMonth(month: string): string {
  return `${month}-01`;
}

/**
 * Number of days in `month` (YYYY-MM), leap years included. Derived from
 * asking for day 0 of the following month — Date.UTC's day argument accepts
 * 0 to mean "the day before the 1st of this month," which is the last day
 * of `month`.
 */
export function getDaysInMonth(month: string): number {
  const { year, month: m } = parseMonthString(month);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/**
 * Adds `months` (negative to subtract) to a YYYY-MM string, returning a new
 * YYYY-MM string. Same Date.UTC-based approach as addDays — year rollover
 * (December → January and back) falls out of the arithmetic for free.
 */
export function addMonths(month: string, months: number): string {
  const { year, month: m } = parseMonthString(month);
  const result = new Date(Date.UTC(year, m - 1 + months, 1));
  const y = result.getUTCFullYear();
  const mm = String(result.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mm}`;
}

import { addDays, formatMonthYearHeading, getMondayOfWeek } from "./dates";
import { isValidDateString } from "./scheduled-workouts-validation";

export type WeekStripView = {
  /** Whole weeks from the current week; 0 = this week, negative = past. */
  weekOffset: number;
  /** Monday of the displayed week, YYYY-MM-DD. */
  monday: string;
  /** The 7 dates of the displayed week, Monday first. */
  weekDates: string[];
  /** Today's date, YYYY-MM-DD. */
  today: string;
  /** The selected day, or null when nothing is selected. */
  selectedDate: string | null;
};

function firstValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolves the home page week strip's URL search params (`week`, the
 * integer week offset, and `day`, the selected date) into a full view of
 * which week and day to render. Both params are validated independently and
 * fall back to the current-week/today default when absent or malformed —
 * a hand-edited or stale URL degrades gracefully rather than erroring the
 * page, same convention as parseWorkoutListSearchParams.
 *
 * `today` must come from the database (see getCurrentDateString) — this
 * function does no timezone-sensitive date derivation itself, only string
 * and integer arithmetic on the dates it's given.
 */
export function resolveWeekStripView(
  searchParams: Record<string, string | string[] | undefined>,
  today: string
): WeekStripView {
  const rawWeek = firstValue(searchParams.week);
  const parsedWeek = rawWeek !== undefined ? Number(rawWeek) : 0;
  const weekOffset = Number.isInteger(parsedWeek) ? parsedWeek : 0;

  const currentMonday = getMondayOfWeek(today);
  const monday = addDays(currentMonday, weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const rawDay = firstValue(searchParams.day);
  const isDayInWeek = isValidDateString(rawDay) && weekDates.includes(rawDay);

  const selectedDate = isDayInWeek
    ? rawDay
    : weekOffset === 0
      ? today
      : null;

  return { weekOffset, monday, weekDates, today, selectedDate };
}

/**
 * The week strip's heading: "This week" / "Next week" / "Last week" for
 * adjacent weeks, otherwise the month and year of the displayed week's
 * Monday (e.g. "September 2026").
 */
export function formatWeekHeading(view: WeekStripView): string {
  if (view.weekOffset === 0) return "This week";
  if (view.weekOffset === 1) return "Next week";
  if (view.weekOffset === -1) return "Last week";
  return formatMonthYearHeading(view.monday);
}

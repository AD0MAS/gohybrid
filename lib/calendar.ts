import {
  addDays,
  diffInDays,
  getDaysInMonth,
  getFirstDayOfMonth,
  getIsoWeekday,
  getMondayOfWeek,
  getMonthString,
} from "./dates";
import { isValidMonthString } from "./scheduled-workouts-validation";
import { firstValue } from "./search-params";

export type CalendarView = {
  /** The displayed month, YYYY-MM. */
  month: string;
  /** Today's date, YYYY-MM-DD. */
  today: string;
  /**
   * Every date rendered in the grid, Monday first, top-left to
   * bottom-right — including leading/trailing days from adjacent months so
   * every week row is complete. Always a multiple of 7.
   */
  gridDates: string[];
};

/**
 * Resolves the /calendar page's `month` URL search param (YYYY-MM) into a
 * full view of which month to render and the Monday-first grid of dates
 * that fills it — same fall-back-on-malformed convention as
 * resolveWeekStripView: an invalid or absent param degrades to the current
 * month rather than erroring the page.
 *
 * `today` must come from the database, in the viewing user's own timezone
 * (see getUserContext in lib/user-settings.ts), so the fallback month
 * agrees with that user's notion of "now," not the server's clock or UTC.
 */
export function resolveCalendarView(
  searchParams: Record<string, string | string[] | undefined>,
  today: string
): CalendarView {
  const rawMonth = firstValue(searchParams.month);
  const month = isValidMonthString(rawMonth) ? rawMonth : getMonthString(today);

  const firstOfMonth = getFirstDayOfMonth(month);
  const leadingCount = getIsoWeekday(firstOfMonth) - 1;
  const gridStart = addDays(firstOfMonth, -leadingCount);

  const daysBeforePadding = leadingCount + getDaysInMonth(month);
  const trailingCount = (7 - (daysBeforePadding % 7)) % 7;
  const gridLength = daysBeforePadding + trailingCount;

  const gridDates = Array.from({ length: gridLength }, (_, i) =>
    addDays(gridStart, i)
  );

  return { month, today, gridDates };
}

/**
 * The week offset (relative to the week containing `today`, same convention
 * as WeekStripView.weekOffset) of the week containing `date` — used to link
 * a calendar day cell to the Workouts page's week strip at
 * /workouts?week=N&day=<date>. Computed from the whole-week difference
 * between that date's Monday and the current week's Monday.
 */
export function getWeekOffsetForDate(date: string, today: string): number {
  const targetMonday = getMondayOfWeek(date);
  const currentMonday = getMondayOfWeek(today);
  return diffInDays(currentMonday, targetMonday) / 7;
}

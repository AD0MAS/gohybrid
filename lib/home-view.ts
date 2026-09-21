import {
  addDays,
  diffInDays,
  formatMonthYearHeading,
  getMondayOfWeek,
  getMonthString,
} from "./dates";
import { isValidDateString } from "./scheduled-workouts-validation";
import { firstValue } from "./search-params";

export type HomeView = {
  /** Today's date, YYYY-MM-DD, in the viewing user's timezone. */
  today: string;
  /** The selected day, YYYY-MM-DD: the one whose cards show under the strip.
   * Changes only when a day cell is clicked. */
  selectedDate: string;
  /** The anchor the strip and the calendar both follow, YYYY-MM-DD: the strip
   * shows its week, the calendar its month. The arrows move it; a day cell
   * sets it to that day. */
  viewDate: string;
  /** The 7 dates of `viewDate`'s week, Monday first. */
  weekDates: string[];
  /** `viewDate`'s month, YYYY-MM. */
  month: string;
  /** Whole weeks from the current week to `viewDate`'s; 0 = this week,
   * negative = past. Only the strip's heading reads it. */
  weekOffset: number;
};

/**
 * A date search param's value as a date, or undefined when it is missing or
 * not a real day. isValidDateString checks only the shape ("2026-02-31"
 * passes it); here the date must also survive addDays' Date.UTC round trip
 * unchanged, which rejects a day that doesn't exist and the years 0–999
 * (Date.UTC maps 0–99 to the 1900s, and addDays doesn't pad the year).
 */
export function parseDayParam(
  value: string | string[] | undefined
): string | undefined {
  const raw = firstValue(value);
  return isValidDateString(raw) && addDays(raw, 0) === raw ? raw : undefined;
}

/**
 * Resolves Home's two URL params into the view the week strip and the month
 * calendar render:
 *
 * - `day`, the selected date (missing or invalid = today);
 * - `view`, the anchor date both follow (missing or invalid = the selected
 *   date).
 *
 * Each is validated as a real date on its own, so a hand-edited or stale URL
 * (an old `?week=…` link, `?day=2026-02-31`) degrades to the defaults rather
 * than erroring the page. Only string and integer arithmetic on the dates
 * it's given, so the result never depends on the server's timezone.
 *
 * `today` must come from the database, in the viewing user's own timezone
 * (see getUserContext in lib/user-settings.ts).
 */
export function resolveHomeView(
  searchParams: Record<string, string | string[] | undefined>,
  today: string
): HomeView {
  const selectedDate = parseDayParam(searchParams.day) ?? today;
  const viewDate = parseDayParam(searchParams.view) ?? selectedDate;

  const monday = getMondayOfWeek(viewDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekOffset = diffInDays(getMondayOfWeek(today), monday) / 7;

  return {
    today,
    selectedDate,
    viewDate,
    weekDates,
    month: getMonthString(viewDate),
    weekOffset,
  };
}

/**
 * The strip's heading: "This week" / "Next week" / "Last week" for adjacent
 * weeks, otherwise the month and year of the displayed week's Monday (e.g.
 * "September 2026").
 */
export function formatWeekHeading(view: HomeView): string {
  if (view.weekOffset === 0) return "This week";
  if (view.weekOffset === 1) return "Next week";
  if (view.weekOffset === -1) return "Last week";
  return formatMonthYearHeading(view.weekDates[0]);
}

/**
 * The Home URL for a selected day and a view anchor — "/" when both are
 * today (the default), otherwise `day` is left out when it is today and
 * `view` when it equals the selected day. Every link that moves the
 * selection or the view, and the `returnTo` an action redirects back to, is
 * built here so the shape has one source.
 */
export function homeHref(
  selectedDate: string,
  viewDate: string,
  today: string
): string {
  const params: string[] = [];
  if (selectedDate !== today) params.push(`day=${selectedDate}`);
  if (viewDate !== selectedDate) params.push(`view=${viewDate}`);
  return params.length > 0 ? `/?${params.join("&")}` : "/";
}

/**
 * True when Home already shows today: today is selected, and the strip shows
 * this week and the calendar this month. The calendar's "Today" button is
 * inert exactly then.
 */
export function isShowingToday(view: HomeView): boolean {
  return (
    view.selectedDate === view.today &&
    view.weekOffset === 0 &&
    view.month === getMonthString(view.today)
  );
}

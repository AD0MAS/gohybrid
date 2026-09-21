import {
  addDays,
  getDaysInMonth,
  getFirstDayOfMonth,
  getIsoWeekday,
} from "./dates";

/**
 * Every date in the month grid for `month` (YYYY-MM), Monday first, top-left
 * to bottom-right — including leading/trailing days from adjacent months so
 * every week row is complete. Always a multiple of 7, and always contains
 * the whole of any week that touches the month.
 */
export function getMonthGridDates(month: string): string[] {
  const firstOfMonth = getFirstDayOfMonth(month);
  const leadingCount = getIsoWeekday(firstOfMonth) - 1;
  const gridStart = addDays(firstOfMonth, -leadingCount);

  const daysBeforePadding = leadingCount + getDaysInMonth(month);
  const trailingCount = (7 - (daysBeforePadding % 7)) % 7;
  const gridLength = daysBeforePadding + trailingCount;

  return Array.from({ length: gridLength }, (_, i) => addDays(gridStart, i));
}

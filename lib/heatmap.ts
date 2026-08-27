import type { DailySessionCount } from "./activity";
import {
  addDays,
  diffInDays,
  formatMonthShort,
  getDayNumber,
  getMondayOfWeek,
} from "./dates";

/**
 * Number of week-columns the activity heatmap's full range covers — 52 full
 * past weeks plus the current (possibly partial) week, i.e. a full year.
 * The desktop grid draws all of these columns; the mobile grid draws only
 * the trailing 26 (see ActivityHeatmap.tsx's MOBILE_WEEKS) from the same
 * fetched range, so there's still only one query for both.
 */
export const HEATMAP_WEEKS = 53;

export type HeatmapCell = {
  /** YYYY-MM-DD. */
  date: string;
  /**
   * Session count for this day, or null when the day is after `to` — a day
   * that hasn't happened yet within an otherwise-complete trailing week.
   * Cells with null render empty so the grid stays rectangular.
   */
  count: number | null;
};

export type HeatmapColumn = {
  /** Monday of this column's week, YYYY-MM-DD. */
  monday: string;
  /** The 7 cells of this column, Monday first. */
  cells: HeatmapCell[];
  /**
   * Month label for this column, e.g. "Sep", when the 1st of a month falls
   * within this column's week; otherwise null.
   */
  monthLabel: string | null;
};

/**
 * The activity heatmap's [from, to] date range: HEATMAP_WEEKS full
 * Monday-first weeks (a full year) ending with the week containing `today`.
 * `from` is always a Monday; `to` is `today` itself, not the end of its
 * week — the days between `today` and the end of its week are legitimately
 * in the future, and buildHeatmapColumns renders them as empty cells rather
 * than as real 0-session days.
 */
export function getHeatmapRange(today: string): { from: string; to: string } {
  const endMonday = getMondayOfWeek(today);
  const from = addDays(endMonday, -(HEATMAP_WEEKS - 1) * 7);
  return { from, to: today };
}

/**
 * Builds the activity heatmap's columns (weeks) of cells (weekdays, Monday
 * first) for the range [`from`, `to`] (see getHeatmapRange), filling in
 * each in-range day's count from `counts` (see getDailySessionCountsForUser)
 * — 0 when the day is absent from `counts`, since absence means no
 * sessions, not unknown. Days after `to` get a null count so the caller can
 * render them as empty cells.
 */
export function buildHeatmapColumns(
  from: string,
  to: string,
  counts: DailySessionCount[]
): HeatmapColumn[] {
  const countByDate = new Map(counts.map((c) => [c.date, c.count]));
  // `from` and the Monday of `to`'s week are both Mondays, so this is
  // always an exact number of weeks regardless of which weekday `to` is.
  const weeks = diffInDays(from, getMondayOfWeek(to)) / 7 + 1;

  return Array.from({ length: weeks }, (_, c) => {
    const monday = addDays(from, c * 7);

    const cells: HeatmapCell[] = Array.from({ length: 7 }, (_, r) => {
      const date = addDays(monday, r);
      const count =
        diffInDays(to, date) > 0 ? null : (countByDate.get(date) ?? 0);
      return { date, count };
    });

    const monthStart = cells.find((cell) => getDayNumber(cell.date) === 1);

    return {
      monday,
      cells,
      monthLabel: monthStart ? formatMonthShort(monthStart.date) : null,
    };
  });
}

import { getMonthGridDates } from "@/lib/calendar";
import {
  formatMonthYearHeading,
  getFirstDayOfMonth,
  shiftMonthClamped,
} from "@/lib/dates";
import { getEventsForUserInRange } from "@/lib/events";
import { homeHref, isShowingToday, type HomeView } from "@/lib/home-view";
import { getScheduledForUserInRange } from "@/lib/scheduled-workouts";
import CalendarLegend from "./CalendarLegend";
import DayGrid, { groupEntriesByDate } from "./_components/DayGrid";
import NavHeader from "./_components/NavHeader";
import {
  SECTION_BUTTON_CLASSES,
  SECTION_BUTTON_DISABLED_CLASSES,
} from "./_components/section-button";
import Link from "next/link";
import { PANEL_CLASSES } from "./_components/shared-classes";

type MonthCalendarProps = {
  userId: string;
  view: HomeView;
};

/**
 * Home's month calendar: the month containing the view anchor (`viewDate`),
 * as the shared DayGrid, under the same "‹ heading ›" header as the week
 * strip, above the status legend and a "Today" button. It shares the
 * strip's two URL params: ‹ › move the view anchor to the same day-of-month
 * in the adjacent month (clamped to that month's last day, see
 * shiftMonthClamped) and leave the selected day alone; a cell — an
 * adjacent-month day included — makes that day both the selected day and
 * the anchor. The selected cell is highlighted only when it is in the grid.
 *
 * "Today" is always rendered, as a link to "/" when Home isn't showing
 * today (isShowingToday) and as a disabled button otherwise.
 *
 * Reads the grid's full date range, adjacent-month days included, so those
 * cells show their entries too. A Server Component like the strip: every
 * control is a plain `Link` with `scroll={false}`, so there is no client JS
 * and the page stays where it is.
 */
export default async function MonthCalendar({
  userId,
  view,
}: MonthCalendarProps) {
  const gridDates = getMonthGridDates(view.month);
  const [scheduled, events] = await Promise.all([
    getScheduledForUserInRange(userId, gridDates[0], gridDates[gridDates.length - 1]),
    getEventsForUserInRange(userId, gridDates[0], gridDates[gridDates.length - 1]),
  ]);

  const monthHref = (months: number) =>
    homeHref(
      view.selectedDate,
      shiftMonthClamped(view.viewDate, months),
      view.today
    );

  return (
    <section className={PANEL_CLASSES}>
      <NavHeader
        heading={formatMonthYearHeading(getFirstDayOfMonth(view.month))}
        prevHref={monthHref(-1)}
        nextHref={monthHref(1)}
        prevLabel="Previous month"
        nextLabel="Next month"
      />

      <DayGrid
        dates={gridDates}
        today={view.today}
        selectedDate={view.selectedDate}
        entriesByDate={groupEntriesByDate(scheduled, events)}
        dimOutsideMonth={view.month}
      />

      <CalendarLegend />

      {isShowingToday(view) ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={SECTION_BUTTON_DISABLED_CLASSES}
        >
          Today
        </button>
      ) : (
        <Link href="/" scroll={false} className={SECTION_BUTTON_CLASSES}>
          Today
        </Link>
      )}
    </section>
  );
}

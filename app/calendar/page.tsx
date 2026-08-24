import Link from "next/link";
import { getWeekOffsetForDate, resolveCalendarView } from "@/lib/calendar";
import {
  addMonths,
  formatMonthYearHeading,
  getDayNumber,
  getFirstDayOfMonth,
  getMonthString,
  WEEKDAY_INITIALS,
} from "@/lib/dates";
import { requireUser } from "@/lib/auth";
import {
  getCurrentDateString,
  getScheduledForUserInRange,
} from "@/lib/scheduled-workouts";

/** Scheduled-workout titles shown per day cell before collapsing the rest
 * into a "+N more" indicator. */
const MAX_VISIBLE_PER_DAY = 2;

/**
 * Month view of scheduled workouts (Layer 2's Calendar): a Monday-first grid
 * for the month named by the `month` search param (YYYY-MM, via
 * resolveCalendarView), with leading/trailing cells from adjacent months
 * completing every week row. Reads the same getScheduledForUserInRange used
 * by the home page's week strip, over the grid's full date range so
 * leading/trailing cells can show their entries too.
 *
 * Entirely a Server Component: month navigation and day-cell links are
 * plain `<Link>`s to new search params, same convention as WeekStrip — an
 * in-month cell links to the home page's week strip for that day
 * (/?week=N&day=<date>), a muted adjacent-month cell instead navigates this
 * page to that month.
 */
export default async function CalendarPage(props: PageProps<"/calendar">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  const today = await getCurrentDateString();
  const view = resolveCalendarView(searchParams, today);

  const scheduled = await getScheduledForUserInRange(
    user.id,
    view.gridDates[0],
    view.gridDates[view.gridDates.length - 1]
  );

  const byDate = new Map<string, typeof scheduled>();
  for (const entry of scheduled) {
    const list = byDate.get(entry.scheduledDate) ?? [];
    list.push(entry);
    byDate.set(entry.scheduledDate, list);
  }

  const monthHref = (month: string) => `/calendar?month=${month}`;
  const weekStripHref = (date: string) =>
    `/?week=${getWeekOffsetForDate(date, today)}&day=${date}`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm underline">
          Home
        </Link>
        <h1 className="text-xl font-semibold">Calendar</h1>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={monthHref(addMonths(view.month, -1))}
          aria-label="Previous month"
          className="px-2 text-sm underline"
        >
          ←
        </Link>
        <h2 className="text-sm font-medium">
          {formatMonthYearHeading(getFirstDayOfMonth(view.month))}
        </h2>
        <Link
          href={monthHref(addMonths(view.month, 1))}
          aria-label="Next month"
          className="px-2 text-sm underline"
        >
          →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-x-auto text-center text-xs text-gray-500">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <span key={i}>{initial}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-x-auto">
        {view.gridDates.map((date) => {
          const inMonth = getMonthString(date) === view.month;
          const isToday = inMonth && date === today;
          const entries = byDate.get(date) ?? [];
          const visibleEntries = entries.slice(0, MAX_VISIBLE_PER_DAY);
          const hiddenCount = entries.length - visibleEntries.length;

          return (
            <Link
              key={date}
              href={inMonth ? weekStripHref(date) : monthHref(getMonthString(date))}
              className={`flex min-h-20 flex-col gap-0.5 border border-gray-200 p-1 text-xs ${
                inMonth ? "" : "text-gray-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday ? "bg-black text-white" : ""
                }`}
              >
                {getDayNumber(date)}
              </span>

              {visibleEntries.map((entry) => {
                const statusClass = entry.sessionId
                  ? "text-green-700"
                  : entry.isSkipped
                    ? "text-gray-400 line-through"
                    : inMonth
                      ? "text-gray-700"
                      : "text-gray-400";

                return (
                  <span key={entry.id} className={`truncate ${statusClass}`}>
                    {entry.workout.title}
                  </span>
                );
              })}

              {hiddenCount > 0 && (
                <span className="text-gray-500">+{hiddenCount} more</span>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}

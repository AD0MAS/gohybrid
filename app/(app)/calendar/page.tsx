import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { getEventsForUserInRange } from "@/lib/events";
import { getScheduledForUserInRange } from "@/lib/scheduled-workouts";
import { getUserContext } from "@/lib/user-settings";
import BackLink from "../_components/BackLink";

export const metadata: Metadata = {
  title: "Calendar",
};

/** Scheduled-workout titles shown per day cell (desktop text list) before
 * collapsing the rest into a "+N more" indicator. */
const MAX_VISIBLE_PER_DAY = 2;

/** Dots shown per day cell (mobile) before collapsing the rest into a
 * "+N" indicator — a separate, larger cap from MAX_VISIBLE_PER_DAY since a
 * dot takes far less width than a truncated title. */
const MAX_VISIBLE_DOTS_PER_DAY = 3;

/**
 * One day cell's entries, scheduled workouts and events merged into a
 * single list per date (see byDate below) so the desktop text list and the
 * mobile dot row can both render off one combined, chronologically
 * meaningless but visually-distinct-by-kind array, rather than each
 * needing to interleave two separate maps itself.
 */
type DayEntry =
  | { kind: "workout"; id: string; title: string; sessionId: string | null; isSkipped: boolean }
  | { kind: "event"; id: string; title: string };

/**
 * Dot colour for one day-cell entry on the mobile grid. An event always
 * reads accent — the app's one token for "this isn't a workout" (same
 * colour EventForm's own trigger and WeekStrip's event cards use) — and is
 * checked first since a DayEntry's other fields don't exist on it.
 * Completed reads success (matches the desktop text list's text-success),
 * skipped reads a muted ink tone (ink-tertiary, matches the desktop list's
 * text-ink-tertiary), and planned reads a plainer neutral ink tone
 * (ink-muted, matches the desktop list's in-month text-ink-muted) so the
 * three remain visually distinct at dot size without needing the desktop
 * list's line-through or out-of-month dimming, neither of which survives
 * at 6px.
 */
function dotClass(entry: DayEntry): string {
  if (entry.kind === "event") return "bg-accent";
  if (entry.sessionId) return "bg-success";
  if (entry.isSkipped) return "bg-ink-tertiary";
  return "bg-ink-muted";
}

/** Desktop text list colour for one day-cell entry — same rules as
 * dotClass, in the text-* form the truncated title itself needs, plus the
 * skipped line-through and out-of-month dimming a 6px dot can't carry. */
function textClass(entry: DayEntry, inMonth: boolean): string {
  if (entry.kind === "event") return "text-accent";
  if (entry.sessionId) return "text-success";
  if (entry.isSkipped) return "text-ink-tertiary line-through";
  return inMonth ? "text-ink-muted" : "text-ink-tertiary";
}

/**
 * Month view of scheduled workouts and events (events added alongside the
 * original calendar view): a Monday-first grid for the month named by the
 * `month` search param (YYYY-MM, via resolveCalendarView), with
 * leading/trailing cells from adjacent months completing every week row.
 * Reads the same getScheduledForUserInRange and getEventsForUserInRange
 * used by the home page's week strip, over the grid's full date range so
 * leading/trailing cells can show their entries too. Events render into
 * the same day cells as scheduled workouts (DayEntry merges both), always
 * accent-coloured to stay visually distinct from any workout status.
 *
 * Entirely a Server Component: month navigation and day-cell links are
 * plain `<Link>`s to new search params, same convention as WeekStrip — an
 * in-month cell links to the Workouts page's week strip for that day
 * (/workouts?week=N&day=<date>), a muted adjacent-month cell instead
 * navigates this page to that month.
 */
export default async function CalendarPage(props: PageProps<"/calendar">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  const { today } = await getUserContext(user.id);
  const view = resolveCalendarView(searchParams, today);

  const gridFrom = view.gridDates[0];
  const gridTo = view.gridDates[view.gridDates.length - 1];
  const [scheduled, rangeEvents] = await Promise.all([
    getScheduledForUserInRange(user.id, gridFrom, gridTo),
    getEventsForUserInRange(user.id, gridFrom, gridTo),
  ]);

  const byDate = new Map<string, DayEntry[]>();
  function pushEntry(date: string, entry: DayEntry) {
    const list = byDate.get(date) ?? [];
    list.push(entry);
    byDate.set(date, list);
  }
  for (const entry of scheduled) {
    pushEntry(entry.scheduledDate, {
      kind: "workout",
      id: entry.id,
      title: entry.workout.title,
      sessionId: entry.sessionId,
      isSkipped: entry.isSkipped,
    });
  }
  for (const event of rangeEvents) {
    pushEntry(event.eventDate, { kind: "event", id: event.id, title: event.title });
  }

  const monthHref = (month: string) => `/calendar?month=${month}`;
  const weekStripHref = (date: string) =>
    `/workouts?week=${getWeekOffsetForDate(date, today)}&day=${date}`;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center gap-2">
        <BackLink href="/workouts" label="Workouts" />
        <h1 className="text-xl font-semibold text-ink">Calendar</h1>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={monthHref(addMonths(view.month, -1))}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <h2 className="text-sm font-medium text-ink">
          {formatMonthYearHeading(getFirstDayOfMonth(view.month))}
        </h2>
        <Link
          href={monthHref(addMonths(view.month, 1))}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 overflow-x-auto text-center text-xs text-ink-subtle">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <span key={i}>{initial}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 overflow-x-auto">
        {view.gridDates.map((date) => {
          const inMonth = getMonthString(date) === view.month;
          const isToday = inMonth && date === today;
          const entries = byDate.get(date) ?? [];
          const visibleEntries = entries.slice(0, MAX_VISIBLE_PER_DAY);
          const hiddenCount = entries.length - visibleEntries.length;
          const visibleDots = entries.slice(0, MAX_VISIBLE_DOTS_PER_DAY);
          const hiddenDotCount = entries.length - visibleDots.length;

          return (
            <Link
              key={date}
              href={inMonth ? weekStripHref(date) : monthHref(getMonthString(date))}
              className={`flex min-h-20 flex-col gap-0.5 rounded-lg border border-hairline bg-surface-1 p-1 text-xs hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus ${
                inMonth ? "text-ink" : "text-ink-tertiary"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday ? "bg-surface-3 text-ink outline outline-1 outline-accent" : ""
                }`}
              >
                {getDayNumber(date)}
              </span>

              <div className="hidden flex-col gap-0.5 md:flex">
                {visibleEntries.map((entry) => (
                  <span
                    key={entry.id}
                    className={`truncate ${textClass(entry, inMonth)}`}
                  >
                    {entry.title}
                  </span>
                ))}

                {hiddenCount > 0 && (
                  <span className="text-ink-subtle">+{hiddenCount} more</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1 md:hidden">
                {visibleDots.map((entry) => (
                  <span
                    key={entry.id}
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(entry)}`}
                    aria-hidden="true"
                  />
                ))}
                {hiddenDotCount > 0 && (
                  <span className="text-[10px] leading-none text-ink-subtle">
                    +{hiddenDotCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

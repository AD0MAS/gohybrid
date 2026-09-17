import Link from "next/link";
import { resolveCalendarView } from "@/lib/calendar";
import {
  formatMonthYearHeading,
  getDayNumber,
  getFirstDayOfMonth,
  getMonthString,
  WEEKDAY_INITIALS,
} from "@/lib/dates";
import { getEventsForUserInRange } from "@/lib/events";
import { getScheduledForUserInRange } from "@/lib/scheduled-workouts";

const HEADER_TRIGGER_CLASSES =
  "rounded-control border border-hairline bg-surface-2 px-4 py-1.5 text-xs font-medium text-ink hover:border-hairline-strong hover:bg-surface-3 active:border-hairline-strong active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** Dots shown per day cell before collapsing the rest into a "+N" indicator —
 * exactly /calendar's own MAX_VISIBLE_DOTS_PER_DAY (app/(app)/calendar/
 * page.tsx), reused at the same value rather than a preview-specific one. */
const MAX_VISIBLE_DOTS_PER_DAY = 3;

type DayEntry =
  | { kind: "event"; id: string }
  | { kind: "workout"; id: string; sessionId: string | null; isSkipped: boolean };

/**
 * One dot's colour for a day-cell entry — exactly /calendar's own dotClass
 * (app/(app)/calendar/page.tsx), including its ordering (event checked
 * first, since a DayEntry's other fields don't exist on it). Duplicated
 * here rather than imported because /calendar's version takes that page's
 * own richer DayEntry shape (it also carries `title`, for its desktop text
 * list, which this dots-only preview never renders) and isn't exported from
 * lib/ — and that page is out of scope for this change. Kept in sync by
 * being the same rule at the same cap (MAX_VISIBLE_DOTS_PER_DAY), not by
 * inventing a coarser one.
 */
function dotClass(entry: DayEntry): string {
  if (entry.kind === "event") return "bg-accent";
  if (entry.sessionId) return "bg-success";
  if (entry.isSkipped) return "bg-ink-tertiary";
  return "bg-ink-muted";
}

type MonthCalendarPreviewProps = {
  userId: string;
  /** YYYY-MM-DD — the week strip's selected day (or today, when nothing is
   * selected). The preview shows *this* date's month, not the month
   * containing `today` — a week spanning two months should show the month
   * the user is actually looking at, not always the current one. */
  anchorDate: string;
  today: string;
};

/**
 * Home's month-calendar preview: a dots-only, non-interactive grid (no
 * prev/next arrows, no day links) of the month containing `anchorDate`, with
 * a "Full calendar" button (styled like /profile's header triggers, e.g.
 * EventForm's own HEADER_TRIGGER_CLASSES) linking to the real, fully
 * interactive /calendar for that same month. Reuses resolveCalendarView
 * (lib/calendar.ts) purely for its Monday-first grid-date math — passing
 * `anchorDate`'s own month as the `month` search param it already knows how
 * to read, rather than duplicating that arithmetic. A pure Server Component,
 * like the rest of Home's week-strip family: no arrows means no navigation
 * state to drive, so there's nothing here that needs to be a Client
 * Component.
 */
export default async function MonthCalendarPreview({
  userId,
  anchorDate,
  today,
}: MonthCalendarPreviewProps) {
  const month = getMonthString(anchorDate);
  const view = resolveCalendarView({ month }, today);

  const gridFrom = view.gridDates[0];
  const gridTo = view.gridDates[view.gridDates.length - 1];
  const [scheduled, events] = await Promise.all([
    getScheduledForUserInRange(userId, gridFrom, gridTo),
    getEventsForUserInRange(userId, gridFrom, gridTo),
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
      sessionId: entry.sessionId,
      isSkipped: entry.isSkipped,
    });
  }
  for (const event of events) {
    pushEntry(event.eventDate, { kind: "event", id: event.id });
  }

  return (
    <section className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
          {formatMonthYearHeading(getFirstDayOfMonth(view.month))}
        </h2>
        <Link href={`/calendar?month=${view.month}`} className={HEADER_TRIGGER_CLASSES}>
          Full calendar
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-ink-tertiary">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <span key={i}>{initial}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {view.gridDates.map((date) => {
          const inMonth = getMonthString(date) === view.month;
          const isToday = inMonth && date === today;
          const entries = inMonth ? (byDate.get(date) ?? []) : [];
          const visibleDots = entries.slice(0, MAX_VISIBLE_DOTS_PER_DAY);
          const hiddenDotCount = entries.length - visibleDots.length;
          // Each cell sets border-color and background from a single
          // three-way choice, never two border-*/bg-* utilities at once —
          // Tailwind can't guarantee source-order wins between two classes
          // touching the same property, so "which one applies" would depend
          // on generated-stylesheet order instead of this component's own
          // isToday/inMonth logic.
          const cellClass = !inMonth
            ? "border-transparent bg-transparent"
            : isToday
              ? "border-accent bg-surface-2"
              : "border-hairline bg-surface-2";

          return (
            <div
              key={date}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-small border p-1 ${cellClass}`}
            >
              <span
                className={`text-[11px] font-medium ${
                  !inMonth
                    ? "text-transparent"
                    : isToday
                      ? "text-ink"
                      : "text-ink-subtle"
                }`}
              >
                {getDayNumber(date)}
              </span>
              {entries.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  {visibleDots.map((entry) => (
                    <span
                      key={entry.id}
                      className={`h-1 w-1 shrink-0 rounded-full ${dotClass(entry)}`}
                      aria-hidden="true"
                    />
                  ))}
                  {hiddenDotCount > 0 && (
                    <span className="text-[8px] leading-none text-ink-subtle">
                      +{hiddenDotCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { getMonthString, WEEKDAY_SHORT_NAMES } from "@/lib/dates";
import { homeHref } from "@/lib/home-view";
import { getScheduledStatus } from "../entry-status";
import DayCell, { type DayCellEntry } from "./DayCell";

/**
 * Merges scheduled workouts and events into one list per date, the shape
 * DayGrid reads. Scheduled entries come first, then events, in the order the
 * queries returned them.
 */
export function groupEntriesByDate(
  scheduled: {
    id: string;
    scheduledDate: string;
    sessionId: string | null;
    isSkipped: boolean;
    workout: { title: string };
  }[],
  events: { id: string; eventDate: string; title: string }[]
): Map<string, DayCellEntry[]> {
  const byDate = new Map<string, DayCellEntry[]>();
  function push(date: string, entry: DayCellEntry) {
    const list = byDate.get(date) ?? [];
    list.push(entry);
    byDate.set(date, list);
  }
  for (const entry of scheduled) {
    push(entry.scheduledDate, {
      id: entry.id,
      title: entry.workout.title,
      status: getScheduledStatus(entry),
    });
  }
  for (const event of events) {
    push(event.eventDate, { id: event.id, title: event.title, status: "event" });
  }
  return byDate;
}

type DayGridProps = {
  /** Every date to draw, Monday first, in rows of seven — a whole month
   * grid or a single week. */
  dates: string[];
  today: string;
  selectedDate: string;
  entriesByDate: Map<string, DayCellEntry[]>;
  /** A month grid passes its month (YYYY-MM) so days outside it are dimmed;
   * the week strip passes nothing and dims nothing. */
  dimOutsideMonth?: string;
};

/**
 * The weekday header and the day cells shared by Home's month calendar and
 * its week strip. Presentational: no data access, no client JS. The caller
 * fetches and buckets the entries; every cell links to Home with that day
 * as both the selected day and the view anchor (`homeHref`), so choosing a
 * day anywhere moves the strip, the calendar and the day cards together.
 */
export default function DayGrid({
  dates,
  today,
  selectedDate,
  entriesByDate,
  dimOutsideMonth,
}: DayGridProps) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[10px] text-ink-tertiary">
        {WEEKDAY_SHORT_NAMES.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {dates.map((date) => (
          <DayCell
            key={date}
            date={date}
            entries={entriesByDate.get(date) ?? []}
            href={homeHref(date, date, today)}
            isToday={date === today}
            isSelected={date === selectedDate}
            isDimmed={
              dimOutsideMonth !== undefined &&
              getMonthString(date) !== dimOutsideMonth
            }
          />
        ))}
      </div>
    </div>
  );
}

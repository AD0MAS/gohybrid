import Link from "next/link";
import {
  formatDayHeading,
  getDayNumber,
  WEEKDAY_INITIALS,
} from "@/lib/dates";
import { getScheduledForUserInRange } from "@/lib/scheduled-workouts";
import { getUserContext } from "@/lib/user-settings";
import { formatWeekHeading, resolveWeekStripView } from "@/lib/week-strip";
import { TAG_COLOR_CLASSES } from "./tag-colors";

const DESCRIPTION_TRUNCATE_LENGTH = 100;

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength
    ? `${text.slice(0, maxLength).trimEnd()}…`
    : text;
}

type WeekStripProps = {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
};

/**
 * Workouts page "this week" strip (Roxfit pattern): seven day cells, Monday
 * first, with prev/next week navigation and the selected day's scheduled
 * workouts underneath. Entirely a Server Component — every interaction
 * (changing week, picking a day) is a plain navigation to a new `week`/`day`
 * search param combination, resolved by resolveWeekStripView, so nothing
 * here needs client-side state. `today` comes from getUserContext, so it's
 * always the viewing user's own calendar day, not the database's UTC one.
 */
export default async function WeekStrip({
  userId,
  searchParams,
}: WeekStripProps) {
  const { today } = await getUserContext(userId);
  const view = resolveWeekStripView(searchParams, today);
  const scheduled = await getScheduledForUserInRange(
    userId,
    view.weekDates[0],
    view.weekDates[6]
  );

  const byDate = new Map<string, typeof scheduled>();
  for (const entry of scheduled) {
    const list = byDate.get(entry.scheduledDate) ?? [];
    list.push(entry);
    byDate.set(entry.scheduledDate, list);
  }

  const selectedEntries = view.selectedDate
    ? (byDate.get(view.selectedDate) ?? [])
    : [];

  const weekHref = (offset: number) =>
    `/workouts?week=${view.weekOffset + offset}`;
  const dayHref = (date: string) =>
    `/workouts?week=${view.weekOffset}&day=${date}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link
          href={weekHref(-1)}
          aria-label="Previous week"
          className="px-2 text-sm underline"
        >
          ←
        </Link>
        <h2 className="text-sm font-medium">{formatWeekHeading(view)}</h2>
        <Link
          href={weekHref(1)}
          aria-label="Next week"
          className="px-2 text-sm underline"
        >
          →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {view.weekDates.map((date, i) => {
          const isSelected = date === view.selectedDate;
          const hasScheduled = (byDate.get(date)?.length ?? 0) > 0;

          return (
            <Link
              key={date}
              href={dayHref(date)}
              className="flex flex-col items-center gap-1 rounded p-1 text-sm"
            >
              <span className="text-xs text-gray-500">
                {WEEKDAY_INITIALS[i]}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isSelected ? "bg-black text-white" : ""
                }`}
              >
                {getDayNumber(date)}
              </span>
              <span
                className={`h-1 w-1 rounded-full ${
                  hasScheduled ? "bg-black" : ""
                }`}
              />
            </Link>
          );
        })}
      </div>

      {view.selectedDate === null ? (
        <p className="text-sm text-gray-600">
          Pick a day above to see what&apos;s scheduled.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {formatDayHeading(view.selectedDate)}
          </h3>

          {selectedEntries.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nothing scheduled on this day.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedEntries.map((entry) => {
                const status = entry.sessionId
                  ? "Completed"
                  : entry.isSkipped
                    ? "Skipped"
                    : "Planned";
                const statusClass = entry.sessionId
                  ? "text-green-700"
                  : entry.isSkipped
                    ? "text-gray-400"
                    : "text-gray-600";

                return (
                  <li
                    key={entry.id}
                    className="rounded border border-gray-300 p-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/workouts/${entry.workout.id}`}
                        className="font-medium underline"
                      >
                        {entry.workout.title}
                      </Link>
                      <span className={`text-xs ${statusClass}`}>
                        {status}
                      </span>
                    </div>

                    {entry.workout.description && (
                      <p className="text-sm text-gray-600">
                        {truncate(
                          entry.workout.description,
                          DESCRIPTION_TRUNCATE_LENGTH
                        )}
                      </p>
                    )}

                    <p className="text-sm text-gray-600">
                      {[
                        entry.workout.primaryType,
                        entry.workout.difficulty,
                        entry.workout.estimatedDurationMinutes != null &&
                          `${entry.workout.estimatedDurationMinutes} min`,
                        entry.scheduledTime != null &&
                          entry.scheduledTime.slice(0, 5),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    {entry.workout.workoutTags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.workout.workoutTags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className={`rounded-full border px-2 py-0.5 text-xs ${TAG_COLOR_CLASSES[tag.color]}`}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

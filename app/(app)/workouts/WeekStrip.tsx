import { ChevronRight } from "lucide-react";
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

/** Text colour per scheduled-entry status, all on the same surface-2 pill
 * background — see the tag pills' NEUTRAL_TAG_CLASSES in tag-colors.ts for
 * the sibling it's deliberately distinguishable from (no border, its own
 * colour per status rather than one neutral tone for every value). */
const STATUS_PILL_TEXT_CLASSES = {
  Completed: "text-success",
  Skipped: "text-ink-tertiary",
  Planned: "text-ink-subtle",
} as const;

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
          className="px-2 text-sm text-ink-subtle underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          ←
        </Link>
        <h2 className="text-sm font-medium text-ink">{formatWeekHeading(view)}</h2>
        <Link
          href={weekHref(1)}
          aria-label="Next week"
          className="px-2 text-sm text-ink-subtle underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
              className="flex flex-col items-center gap-1 rounded p-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              <span className="text-xs text-ink-subtle">
                {WEEKDAY_INITIALS[i]}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isSelected
                    ? "bg-surface-2 text-ink outline outline-1 outline-accent"
                    : "text-ink"
                }`}
              >
                {getDayNumber(date)}
              </span>
              <span
                className={`h-1 w-1 rounded-full ${
                  hasScheduled ? "bg-accent" : ""
                }`}
              />
            </Link>
          );
        })}
      </div>

      {view.selectedDate === null ? (
        <p className="text-sm text-ink-subtle">
          Pick a day above to see what&apos;s scheduled.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">
            {formatDayHeading(view.selectedDate)}
          </h3>

          {selectedEntries.length === 0 ? (
            <p className="text-sm text-ink-subtle">
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

                return (
                  <li
                    key={entry.id}
                    className="relative cursor-pointer rounded border border-hairline bg-surface-1 py-5 pl-5 pr-10 hover:bg-surface-2"
                  >
                    <Link
                      href={`/workouts/${entry.workout.id}`}
                      className="font-medium text-ink after:absolute after:inset-0 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                    >
                      {entry.workout.title}
                    </Link>

                    {entry.workout.description && (
                      <p className="text-sm text-ink-subtle">
                        {truncate(
                          entry.workout.description,
                          DESCRIPTION_TRUNCATE_LENGTH
                        )}
                      </p>
                    )}

                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-subtle">
                      <span
                        className={`shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs ${STATUS_PILL_TEXT_CLASSES[status]}`}
                      >
                        {status}
                      </span>
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
                    <ChevronRight className="absolute right-5 top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 text-ink-subtle" />
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

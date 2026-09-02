import { ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  markScheduledWorkoutDone,
  markScheduledWorkoutSkipped,
  unscheduleWorkout,
} from "../upcoming-actions";
import ConfirmModal from "../_components/ConfirmModal";
import {
  formatDayHeading,
  getDayNumber,
  WEEKDAY_INITIALS,
} from "@/lib/dates";
import { getScheduledForUserInRange } from "@/lib/scheduled-workouts";
import { getUserContext } from "@/lib/user-settings";
import { formatWeekHeading, resolveWeekStripView } from "@/lib/week-strip";
import { TAG_COLOR_CLASSES } from "./tag-colors";

const REMOVE_BUTTON_CLASSES =
  "text-sm text-ink-subtle hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

const DESCRIPTION_TRUNCATE_LENGTH = 100;

/** Background + text per scheduled-entry status. A shared bg-surface-2 fill
 * used to carry the pill, but surface-2 sits only one step above this card's
 * surface-1 background — nearly invisible. Each status now tints its own
 * colour into the background at low opacity (same `/NN` pattern as the
 * border-danger/40 error banners elsewhere), so the pill reads as a distinct
 * surface without needing a border — see the tag pills' NEUTRAL_TAG_CLASSES
 * in tag-colors.ts for the sibling this is deliberately distinguishable
 * from (one neutral tone for every tag, vs. its own colour per status). */
const STATUS_PILL_CLASSES = {
  Completed: "bg-success/15 text-success",
  Skipped: "bg-ink-tertiary/15 text-ink-tertiary",
  Planned: "bg-ink-subtle/15 text-ink-subtle",
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
 *
 * Each entry also carries the same Mark done / Mark skipped / Remove
 * controls as UpcomingList (GOHYBRID_PLAN.md §5A), bound to the identical
 * Server Actions in app/(app)/upcoming-actions.ts — this is the only place
 * that can reach a *past* scheduled entry (UpcomingList only ever lists
 * today-or-later, not-yet-completed ones), so it's also the only place a
 * past-dated entry can be completed, skipped or removed. Which controls
 * show depends on status: Planned gets all three; Completed gets only
 * Remove (un-completing would mean deleting a session, which belongs to
 * /history, not here); Skipped gets Mark done and Remove (un-skipping is
 * just marking it done or removing it).
 *
 * Removing a Completed entry also deletes its workout_session
 * (unscheduleForUser, lib/scheduled-workouts.ts) — a plain one-click Remove
 * would silently erase training history, so that case goes through
 * ConfirmModal instead of the plain one-click form Planned/Skipped use,
 * warning that the session is deleted from training history and stats too.
 * UpcomingList never needs this: getUpcomingForUser filters to session_id
 * IS NULL, so a Completed entry can never reach it — this is the only place
 * Remove can act on one.
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
                    className="relative cursor-pointer rounded-lg border border-hairline bg-surface-1 py-5 pl-5 pr-10 hover:bg-surface-2"
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
                        className={`shrink-0 rounded-full px-2 py-0.5 text-sm ${STATUS_PILL_CLASSES[status]}`}
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

                    <div className="relative z-10 mt-2 flex gap-4">
                      {status !== "Completed" && (
                        <form
                          action={markScheduledWorkoutDone.bind(null, entry.id)}
                        >
                          <button
                            type="submit"
                            className="text-sm text-ink-subtle hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                          >
                            Mark done
                          </button>
                        </form>
                      )}
                      {status === "Planned" && (
                        <form
                          action={markScheduledWorkoutSkipped.bind(
                            null,
                            entry.id,
                            true
                          )}
                        >
                          <button
                            type="submit"
                            className="text-sm text-ink-subtle hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                          >
                            Mark skipped
                          </button>
                        </form>
                      )}
                      {status === "Completed" ? (
                        <ConfirmModal
                          trigger="Remove"
                          triggerClassName={REMOVE_BUTTON_CLASSES}
                          title="Delete scheduled entry"
                          description="Deleting this scheduled entry also deletes its workout session. It will be removed from training history and from all stats."
                          confirmLabel="Delete"
                          action={unscheduleWorkout.bind(null, entry.id)}
                        />
                      ) : (
                        <form action={unscheduleWorkout.bind(null, entry.id)}>
                          <button type="submit" className={REMOVE_BUTTON_CLASSES}>
                            Remove
                          </button>
                        </form>
                      )}
                    </div>
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

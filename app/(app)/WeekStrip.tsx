import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  markScheduledWorkoutDone,
  markScheduledWorkoutSkipped,
  unscheduleWorkout,
} from "./upcoming-actions";
import CardMenu, {
  MENU_ITEM_CLASSES,
  MENU_ITEM_DANGER_CLASSES,
} from "./_components/CardMenu";
import ConfirmModal from "./_components/ConfirmModal";
import EventCard from "./_components/EventCard";
import ScheduleWorkoutForm from "./_components/ScheduleWorkoutForm";
import { SubmitButton } from "@/app/_components/FormStatus";
import {
  formatDayHeading,
  getDayNumber,
  getMonthString,
  WEEKDAY_INITIALS,
} from "@/lib/dates";
import { getEventsForUserInRange } from "@/lib/events";
import { getScheduledForUserInRange } from "@/lib/scheduled-workouts";
import { toClockTimeInTimezone } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";
import { formatWeekHeading, resolveWeekStripView } from "@/lib/week-strip";
import { DIFFICULTY_LABELS } from "./workouts/difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "./workouts/primary-type-labels";

const DESCRIPTION_TRUNCATE_LENGTH = 100;

/** Background + text per scheduled-entry status. Each status tints its own
 * colour into the background at low opacity (same `/NN` pattern as the
 * border-danger/40 error banners elsewhere), so the pill reads as a distinct
 * surface against the day card's own surface-2 fill without needing a
 * border — see the tag pills' NEUTRAL_TAG_CLASSES in tag-colors.ts for the
 * sibling this is deliberately distinguishable from (one neutral tone for
 * every tag, vs. its own colour per status). */
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
 * Home's "this week" strip (Roxfit pattern): seven day cells, Monday
 * first, with prev/next week navigation and the selected day's scheduled
 * workouts and events underneath. Entirely a Server Component — every
 * interaction (changing week, picking a day) is a plain navigation to a new
 * `week`/`day` search param combination, resolved by resolveWeekStripView —
 * except each day card's own action menu (CardMenu, app/(app)/_components/
 * CardMenu.tsx) and EventCard's edit modal, the two small client boundaries
 * this file composes rather than owns itself (see each one's own doc
 * comment for why it has to be a client component: a Server Component can
 * only pass serializable props into one, never a function, and both need
 * either open/close state or a callback a Server Component can't hold).
 * `today` comes from getUserContext, so it's always the viewing user's own
 * calendar day, not the database's UTC one.
 *
 * This is also the only surface that can reach a *past* scheduled entry —
 * Home's TODAY card only ever looks at `today` itself. Which controls the
 * day card's menu shows depends on status: Planned gets all of Mark done,
 * Mark skipped, Reschedule and Open workout; Completed gets only Open
 * workout (un-completing would mean deleting a session, which belongs to
 * /history, not here); Skipped gets Mark done, Open workout, and Reschedule
 * (un-skipping is just marking it done or moving it). Remove is on every
 * status.
 *
 * Removing a Completed entry also deletes its workout_session
 * (unscheduleForUser, lib/scheduled-workouts.ts) — a plain one-click Remove
 * would silently erase training history, so that case goes through
 * ConfirmModal instead of the plain one-click form Planned/Skipped use,
 * warning that the session is deleted from training history and stats too.
 *
 * Every action collapses into one CardMenu (app/(app)/_components/
 * CardMenu.tsx, the same three-dot pattern /profile's goal cards use) —
 * Mark done, Mark skipped, Reschedule, Open workout, Remove, whichever
 * subset applies to that entry's status. The card itself is no longer a
 * link: Open workout (a plain Link inside the menu, carrying the same
 * `from=workouts&week=&day=` query the title link used to) replaces that,
 * so a tap anywhere on the row no longer competes with the menu's own
 * click-to-open-then-click-an-item gesture.
 *
 * Events render as their own cards via EventCard
 * (app/(app)/_components/EventCard.tsx) — same CardMenu pattern, but with
 * only Edit and Remove: an event has no done/skipped state in the schema
 * (see EventCard's own doc comment for why, and for why it needed its own
 * file rather than living inline here the way it first did).
 *
 * Below `sm`, the panel ends with an "Open month calendar" link to
 * /calendar?month=<the displayed day's month> — Home's month-calendar
 * preview (MonthCalendarPreview.tsx) is hidden at that width, so this is
 * the only way to reach it without the sidebar's own nav.
 */
export default async function WeekStrip({
  userId,
  searchParams,
}: WeekStripProps) {
  const { today, timezone } = await getUserContext(userId);
  const view = resolveWeekStripView(searchParams, today);
  const [scheduled, events] = await Promise.all([
    getScheduledForUserInRange(userId, view.weekDates[0], view.weekDates[6]),
    getEventsForUserInRange(userId, view.weekDates[0], view.weekDates[6]),
  ]);

  const byDate = new Map<string, typeof scheduled>();
  for (const entry of scheduled) {
    const list = byDate.get(entry.scheduledDate) ?? [];
    list.push(entry);
    byDate.set(entry.scheduledDate, list);
  }

  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByDate.get(event.eventDate) ?? [];
    list.push(event);
    eventsByDate.set(event.eventDate, list);
  }

  const selectedEntries = view.selectedDate
    ? (byDate.get(view.selectedDate) ?? [])
    : [];
  const selectedEvents = view.selectedDate
    ? (eventsByDate.get(view.selectedDate) ?? [])
    : [];

  // Both collapse to the bare "/" when the resulting view is exactly the
  // default resolveWeekStripView already falls back to with no params at
  // all (weekOffset 0, day unset → selectedDate = today) — "/?week=0" and
  // "/?week=0&day=<today>" render identically, so the query string is
  // never anything other than redundant there.
  const isDefaultView = (offset: number, date?: string) =>
    view.weekOffset + offset === 0 && (date === undefined || date === today);
  const weekHref = (offset: number) =>
    isDefaultView(offset) ? "/" : `/?week=${view.weekOffset + offset}`;
  const dayHref = (date: string) =>
    isDefaultView(0, date) ? "/" : `/?week=${view.weekOffset}&day=${date}`;
  const openWorkoutHref = (workoutId: string, date: string) =>
    `/workouts/${workoutId}?from=workouts&week=${view.weekOffset}&day=${date}`;
  const calendarMonth = getMonthString(view.selectedDate ?? today);

  // Both the week-arrow and day-cell Links below pass scroll={false}: App
  // Router scrolls to the top of the page after every navigation by
  // default, which reads as a full reload for a strip whose whole point is
  // staying in place while its own server-rendered content changes
  // underneath. Not needed on openWorkoutHref/the calendar link — those are
  // genuine navigations to a different page, where landing at the top is
  // what's expected.

  return (
    <section className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <Link
          href={weekHref(-1)}
          scroll={false}
          aria-label="Previous week"
          className="flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </Link>
        <h2 className="text-sm font-medium text-ink">{formatWeekHeading(view)}</h2>
        <Link
          href={weekHref(1)}
          scroll={false}
          aria-label="Next week"
          className="flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {view.weekDates.map((date, i) => {
          const isSelected = date === view.selectedDate;
          const isToday = date === today;
          const hasScheduled =
            (byDate.get(date)?.length ?? 0) > 0 ||
            (eventsByDate.get(date)?.length ?? 0) > 0;

          return (
            <Link
              key={date}
              href={dayHref(date)}
              scroll={false}
              className="flex flex-col items-center gap-1 rounded-control p-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              <span className="text-xs text-ink-subtle">
                {WEEKDAY_INITIALS[i]}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isSelected
                    ? "bg-accent text-white"
                    : isToday
                      ? "text-ink outline outline-1 outline-accent"
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

          {selectedEntries.length === 0 && selectedEvents.length === 0 ? (
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
                // A Completed entry shows when the linked session was
                // actually finished (session.completedAt, converted to the
                // user's own timezone), never scheduled_time — the two can
                // genuinely disagree (scheduled for 20:00, done at 18:00 via
                // logPastSession or Mark done), and scheduled_time is never
                // overwritten to match, so it stays visible as "planned for"
                // once you open the entry, just not on this summary line.
                // Planned/Skipped still show scheduled_time, the only time
                // that exists for them.
                const displayTime =
                  status === "Completed" && entry.session
                    ? toClockTimeInTimezone(entry.session.completedAt, timezone)
                    : entry.scheduledTime?.slice(0, 5);

                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-4 rounded-card border border-hairline bg-surface-2 p-4"
                  >
                    <div className="min-w-0 flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words font-medium text-ink">
                          {entry.workout.title}
                        </span>
                        <span
                          className={`shrink-0 rounded-small px-3 py-0.5 text-xs ${STATUS_PILL_CLASSES[status]}`}
                        >
                          {status}
                        </span>
                      </div>

                      {entry.workout.description && (
                        <p className="text-sm text-ink-subtle">
                          {truncate(
                            entry.workout.description,
                            DESCRIPTION_TRUNCATE_LENGTH
                          )}
                        </p>
                      )}

                      <p className="text-sm text-ink-subtle">
                        {[
                          PRIMARY_TYPE_LABELS[entry.workout.primaryType].label,
                          DIFFICULTY_LABELS[entry.workout.difficulty].label,
                          entry.workout.estimatedDurationMinutes != null &&
                            `${entry.workout.estimatedDurationMinutes} min`,
                          displayTime,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <CardMenu>
                      {status !== "Completed" && (
                        <form
                          action={markScheduledWorkoutDone.bind(null, entry.id)}
                        >
                          <SubmitButton className={MENU_ITEM_CLASSES}>
                            Mark done
                          </SubmitButton>
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
                          <SubmitButton className={MENU_ITEM_CLASSES}>
                            Mark skipped
                          </SubmitButton>
                        </form>
                      )}
                      {status !== "Completed" && (
                        <ScheduleWorkoutForm
                          today={today}
                          entry={{
                            id: entry.id,
                            scheduledDate: entry.scheduledDate,
                            scheduledTime: entry.scheduledTime,
                            notes: entry.notes,
                          }}
                          triggerVariant="menu-item"
                        />
                      )}
                      <Link
                        href={openWorkoutHref(
                          entry.workout.id,
                          entry.scheduledDate
                        )}
                        className={MENU_ITEM_CLASSES}
                      >
                        Open workout
                      </Link>
                      {status === "Completed" ? (
                        <ConfirmModal
                          trigger="Remove"
                          triggerClassName={MENU_ITEM_DANGER_CLASSES}
                          title="Delete scheduled entry"
                          description="Deleting this scheduled entry also deletes its workout session. It will be removed from training history and from all stats."
                          confirmLabel="Delete"
                          action={unscheduleWorkout.bind(null, entry.id)}
                        />
                      ) : (
                        <form action={unscheduleWorkout.bind(null, entry.id)}>
                          <SubmitButton className={MENU_ITEM_DANGER_CLASSES}>
                            Remove
                          </SubmitButton>
                        </form>
                      )}
                    </CardMenu>
                  </li>
                );
              })}

              {selectedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>
      )}

      <Link
        href={`/calendar?month=${calendarMonth}`}
        className="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:hidden"
      >
        Open month calendar
      </Link>
    </section>
  );
}

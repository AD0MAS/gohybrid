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
import { FormPendingBanner, SubmitButton } from "@/app/_components/FormStatus";
import { addDays, formatDayHeading } from "@/lib/dates";
import { getEventsForUserInRange } from "@/lib/events";
import { getScheduledForUserInRange } from "@/lib/scheduled-workouts";
import { toClockTimeInTimezone } from "@/lib/timezone";
import { getUserContext } from "@/lib/user-settings";
import { formatWeekHeading, homeHref, type HomeView } from "@/lib/home-view";
import {
  getScheduledStatus,
  STATUS_LABELS,
  STATUS_BADGE_CLASSES,
} from "./entry-status";
import DayGrid, { groupEntriesByDate } from "./_components/DayGrid";
import NavHeader from "./_components/NavHeader";
import { DIFFICULTY_LABELS } from "./workouts/difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "./workouts/primary-type-labels";
import { PANEL_CLASSES } from "./_components/shared-classes";

type WeekStripProps = {
  userId: string;
  /** The resolved `?day`/`?view` view (lib/home-view.ts) — Home's page
   * resolves it once and hands it to both this strip and the month
   * calendar. */
  view: HomeView;
};

/**
 * Home's week strip: the view anchor's week as seven day cells, Monday
 * first — the exact same square DayCell the month calendar draws — with
 * prev/next week arrows and, underneath, the *selected* day's scheduled
 * workouts and events under its date heading. Entirely a Server
 * Component: every interaction is a plain `Link` (`scroll={false}`, so the
 * page stays put) to `/?day=<selected>&view=<anchor>`, resolved once by
 * resolveHomeView and shared with the month calendar, so the two always show
 * the anchor's week and month. The arrows move only the anchor, by seven
 * days — the selected day, and so the cards, stay put, and the day cards keep
 * showing it even when the strip has moved to another week; a cell makes its
 * day both the selected day and the anchor. The exceptions to "no client
 * code" are each day card's own action menu (CardMenu,
 * app/(app)/_components/CardMenu.tsx) and EventCard's edit modal, the two
 * small client boundaries this file composes rather than owns (a Server
 * Component can only pass serializable props into one, never a function, and
 * both need open/close state or a callback a Server Component can't hold).
 * `view.today` comes from getUserContext, so it's always the viewing user's
 * own calendar day.
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
 * CardMenu.tsx, the same three-dot pattern /profile's goal cards use). The
 * card itself is not a link: Open workout (a plain Link inside the menu,
 * carrying `from=home-strip&day=`) replaces that, so a tap anywhere on the
 * row doesn't compete with the menu's own click-to-open gesture.
 *
 * Events render as their own cards via EventCard
 * (app/(app)/_components/EventCard.tsx) — same CardMenu pattern, but with
 * only Edit and Remove: an event has no done/skipped state in the schema.
 */
export default async function WeekStrip({ userId, view }: WeekStripProps) {
  const { timezone } = await getUserContext(userId);
  const { today } = view;
  const [scheduled, events] = await Promise.all([
    getScheduledForUserInRange(userId, view.weekDates[0], view.weekDates[6]),
    getEventsForUserInRange(userId, view.weekDates[0], view.weekDates[6]),
  ]);

  // The cards belong to the selected day, which is not necessarily in the
  // week on show: the arrows can move the strip away from it. When it is
  // outside, its entries are read on their own.
  const selectedInWeek = view.weekDates.includes(view.selectedDate);
  const [selectedEntries, selectedEvents] = selectedInWeek
    ? [
        scheduled.filter((e) => e.scheduledDate === view.selectedDate),
        events.filter((e) => e.eventDate === view.selectedDate),
      ]
    : await Promise.all([
        getScheduledForUserInRange(userId, view.selectedDate, view.selectedDate),
        getEventsForUserInRange(userId, view.selectedDate, view.selectedDate),
      ]);

  const weekHref = (offsetWeeks: number) =>
    homeHref(
      view.selectedDate,
      addDays(view.viewDate, offsetWeeks * 7),
      today
    );
  const openWorkoutHref = (workoutId: string, date: string) =>
    `/workouts/${workoutId}?from=home-strip&day=${date}`;
  // Where an edit that moves an entry to another day comes back to: this
  // same view, scrolled to the strip. The moved entry's card (and any banner
  // its own form would show) is gone by then, so the confirmation comes from
  // the page instead — see lib/redirect-back.ts.
  const returnTo = `${homeHref(view.selectedDate, view.viewDate, today)}#week-strip`;

  // The week-arrow Links and every day cell pass scroll={false}: App Router
  // scrolls to the top of the page after every navigation by default, which
  // reads as a full reload for a strip whose whole point is staying in place
  // while its own server-rendered content changes underneath. Not needed on
  // openWorkoutHref — a genuine navigation to a different page, where
  // landing at the top is what's expected.

  return (
    <section
      id="week-strip"
      className={PANEL_CLASSES}
    >
      <NavHeader
        heading={formatWeekHeading(view)}
        prevHref={weekHref(-1)}
        nextHref={weekHref(1)}
        prevLabel="Previous week"
        nextLabel="Next week"
      />

      <DayGrid
        dates={view.weekDates}
        today={today}
        selectedDate={view.selectedDate}
        entriesByDate={groupEntriesByDate(scheduled, events)}
      />

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
              const status = getScheduledStatus(entry);
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
                status === "completed" && entry.session
                  ? toClockTimeInTimezone(entry.session.completedAt, timezone)
                  : entry.scheduledTime?.slice(0, 5);

              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 rounded-card border border-hairline bg-surface-2 p-4"
                >
                  <div className="min-w-0 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-medium text-ink">
                        {entry.workout.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-small px-3 py-0.5 text-xs ${STATUS_BADGE_CLASSES[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>

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
                    {status !== "completed" && (
                      <form
                        action={markScheduledWorkoutDone.bind(null, entry.id)}
                      >
                        <SubmitButton className={MENU_ITEM_CLASSES}>
                          Mark done
                        </SubmitButton>
                        <FormPendingBanner label="Marking done…" />
                      </form>
                    )}
                    {status === "planned" && (
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
                        <FormPendingBanner label="Marking skipped…" />
                      </form>
                    )}
                    {status !== "completed" && (
                      <ScheduleWorkoutForm
                        today={today}
                        entry={{
                          id: entry.id,
                          scheduledDate: entry.scheduledDate,
                          scheduledTime: entry.scheduledTime,
                          notes: entry.notes,
                        }}
                        triggerVariant="menu-item"
                        returnTo={returnTo}
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
                    {status === "completed" ? (
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
                        <FormPendingBanner label="Removing…" />
                      </form>
                    )}
                  </CardMenu>
                </li>
              );
            })}

            {selectedEvents.map((event) => (
              <EventCard key={event.id} event={event} returnTo={returnTo} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

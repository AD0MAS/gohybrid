import Link from "next/link";
import { FormPendingBanner, SubmitButton } from "@/app/_components/FormStatus";
import { getNextScheduledForUserOnDate } from "@/lib/scheduled-workouts";
import ScheduleWorkoutForm from "./_components/ScheduleWorkoutForm";
import { markScheduledWorkoutDone } from "./upcoming-actions";
import { DIFFICULTY_LABELS } from "./workouts/difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "./workouts/primary-type-labels";
import {
  EYEBROW_CLASSES,
  SUBMIT_BUTTON_CLASSES_FULL_SELF_START,
} from "./_components/shared-classes";

// The bordered secondary below matches the primary button's own height/
// padding/text size, same as /profile's own header, which pairs exactly
// this (its "Settings" link) beside the accent "Add goal" button. Not one
// of shared-classes.ts's constants — /settings' own Sign out is the only
// other place using this exact w-full/sm:w-auto shape, not enough call
// sites yet to be worth extracting.
const SECONDARY_BUTTON_CLASSES =
  "flex h-11 w-full items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto";

type TodayHeroProps = {
  userId: string;
  today: string;
  /** Where Reschedule comes back to when it moves the entry off today — the
   * week-strip view the user is on. See lib/redirect-back.ts. */
  returnTo: string;
};

/**
 * Home's TODAY card: the single next thing to do today, or — when nothing
 * is planned — the same eyebrow/heading/paragraph/primary-button shape
 * page.tsx's brand-new-user START HERE card uses, worded for someone who
 * already has workouts but nothing scheduled today specifically. Reads
 * getNextScheduledForUserOnDate directly (lib/scheduled-workouts.ts) rather
 * than reusing WeekStrip's own range query — WeekStrip's selected day
 * follows week/day navigation, but this card is always about `today`
 * specifically, and always the single soonest still-open entry (see that
 * function's own doc comment for the tie-break), never the whole day's
 * list. Deliberately does not handle the brand-new-user case (no workouts,
 * no sessions ever) — page.tsx renders a separate START HERE card instead
 * of this one for that state, since "nothing scheduled today" and "there is
 * nothing here at all yet" are different situations needing different copy.
 *
 * Start workout / Mark done / Reschedule reuse the exact controls WeekStrip
 * and the workout detail page already use for the same entry
 * (markScheduledWorkoutDone, ScheduleWorkoutForm) — this card is a shortcut
 * to the same actions, not a parallel implementation of them.
 */
export default async function TodayHero({
  userId,
  today,
  returnTo,
}: TodayHeroProps) {
  const entry = await getNextScheduledForUserOnDate(userId, today);

  if (!entry) {
    return (
      <section className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-6 sm:p-7">
        <p className={EYEBROW_CLASSES}>Today</p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-page-title">
          Nothing planned for today
        </h2>
        <p className="max-w-xl text-sm text-ink-subtle">
          Pick a workout from your library and schedule it, or start one
          straight away — it&apos;ll show up here once it&apos;s on today.
        </p>
        <Link href="/workouts" className={SUBMIT_BUTTON_CLASSES_FULL_SELF_START}>
          Go to My Workouts
        </Link>
      </section>
    );
  }

  const meta = [
    DIFFICULTY_LABELS[entry.workout.difficulty].label,
    entry.workout.estimatedDurationMinutes != null &&
      `${entry.workout.estimatedDurationMinutes} min`,
    entry.scheduledTime?.slice(0, 5),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex flex-col gap-6 rounded-panel border border-hairline bg-surface-1 p-6 sm:p-7">
      <div className="flex min-w-0 flex-col gap-2.5">
        <p className={EYEBROW_CLASSES}>Today</p>
        <h2 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink sm:text-page-title">
          {entry.workout.title}
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
          <span className="shrink-0 rounded-small border border-hairline bg-surface-3 px-3 py-1 text-xs font-medium text-ink-muted">
            {PRIMARY_TYPE_LABELS[entry.workout.primaryType].label}
          </span>
          {meta}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href={`/workouts/${entry.workout.id}/start`} className={SUBMIT_BUTTON_CLASSES_FULL_SELF_START}>
          Start workout
        </Link>
        {/* Below sm: Mark done and Reschedule split this row into equal
            halves. From sm up, sm:contents drops this wrapper from the box
            tree so both rejoin the flex row above as ordinary, content-sized
            flex items — exactly the pre-mobile-fix layout, three in a row. */}
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <form action={markScheduledWorkoutDone.bind(null, entry.id)}>
            <SubmitButton className={SECONDARY_BUTTON_CLASSES}>
              Mark done
            </SubmitButton>
            <FormPendingBanner label="Marking done…" />
          </form>
          <ScheduleWorkoutForm
            // Keyed by entry so a reschedule that hands the card to the next
            // entry remounts the form instead of reusing this instance.
            key={entry.id}
            today={today}
            returnTo={returnTo}
            entry={{
              id: entry.id,
              scheduledDate: entry.scheduledDate,
              scheduledTime: entry.scheduledTime,
              notes: entry.notes,
            }}
            triggerVariant="button"
            triggerClassName={SECONDARY_BUTTON_CLASSES}
          />
        </div>
      </div>
    </section>
  );
}

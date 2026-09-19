import Link from "next/link";
import { SubmitButton } from "@/app/_components/FormStatus";
import { getNextScheduledForUserOnDate } from "@/lib/scheduled-workouts";
import ScheduleWorkoutForm from "./_components/ScheduleWorkoutForm";
import { markScheduledWorkoutDone } from "./upcoming-actions";
import { DIFFICULTY_LABELS } from "./workouts/difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "./workouts/primary-type-labels";

// Exactly /workouts' own empty-state hero button (app/(app)/workouts/page.tsx,
// "Create your first workout") and /profile's (GoalFields.tsx's own accent
// button, rendered as "Set your first goal" by GoalsList's hero) — the same
// h-11/rounded-control/px-5/text-base convention both pages already use for
// a primary, page-owning action. The bordered secondary below matches that
// same height/padding/text size, same as /profile's own header, which pairs
// exactly this (its "Settings" link) beside the accent "Add goal" button.
// Duplicated here rather than imported: every other trigger-class constant
// in this codebase (BUTTON_TRIGGER_CLASSES, CTA_CLASSES, ...) is its own
// per-file copy with a comment pointing at the original, not a shared
// export.
const PRIMARY_BUTTON_CLASSES =
  "flex h-11 w-full items-center justify-center self-start rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto";
const SECONDARY_BUTTON_CLASSES =
  "flex h-11 w-full items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto";

const EYEBROW_CLASSES =
  "text-xs font-medium uppercase tracking-widest text-accent-ink-subtle";

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
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          Nothing planned for today
        </h2>
        <p className="max-w-xl text-sm text-ink-subtle">
          Pick a workout from your library and schedule it, or start one
          straight away — it&apos;ll show up here once it&apos;s on today.
        </p>
        <Link href="/workouts" className={PRIMARY_BUTTON_CLASSES}>
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
        <h2 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
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
        <Link href={`/workouts/${entry.workout.id}/start`} className={PRIMARY_BUTTON_CLASSES}>
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

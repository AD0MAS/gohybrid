import Link from "next/link";
import { getWorkoutsForUser } from "@/lib/workouts";
import { SECTION_BUTTON_CLASSES } from "./_components/section-button";
import { PANEL_CLASSES_COMPACT } from "./_components/shared-classes";
import LogPastSessionForm from "./_components/LogPastSessionForm";
import ScheduleWorkoutForm from "./_components/ScheduleWorkoutForm";

type QuickActionsProps = {
  userId: string;
  today: string;
  /** Whether the user owns any workout — passed down from Home's own
   * getWorkoutCountForUser rather than queried again here. With none,
   * Schedule a workout and Log a past session have nothing to pick from
   * (both need an existing workout), so only New workout renders and the
   * workout list itself is never fetched. */
  hasWorkouts: boolean;
};

/**
 * Home's quick actions, stacked at full width in SECTION_BUTTON_CLASSES like
 * every other secondary section button: New workout (a plain Link to
 * /workouts/new?from=home — the `from` param sends /workouts/new's BackLink
 * back to Home instead of its default /workouts, since this is the second
 * entry point that page now has), plus, once the user owns a workout,
 * Schedule a workout and Log a past session (ScheduleWorkoutForm's and
 * LogPastSessionForm's no-known-workoutId branches, each with a workout
 * picker). Not accent — this page's one accent primary action is already
 * TodayHero's Start workout.
 * `getWorkoutsForUser(userId, { sort: "title" })` matches WorkoutPicker's
 * own doc comment: a user's own workout list is small enough for a plain
 * alphabetical <select>, no grouping needed.
 */
export default async function QuickActions({
  userId,
  today,
  hasWorkouts,
}: QuickActionsProps) {
  const workouts = hasWorkouts
    ? (await getWorkoutsForUser(userId, { sort: "title" })).map((workout) => ({
        id: workout.id,
        title: workout.title,
      }))
    : [];

  return (
    <section className={PANEL_CLASSES_COMPACT}>
      <h2 className="text-section font-semibold text-ink">
        Quick actions
      </h2>
      <div className="flex flex-col gap-2">
        <Link href="/workouts/new?from=home" className={SECTION_BUTTON_CLASSES}>
          New workout
        </Link>
        {hasWorkouts && (
          <>
            <ScheduleWorkoutForm
              today={today}
              workouts={workouts}
              triggerClassName={SECTION_BUTTON_CLASSES}
            />
            <LogPastSessionForm
              today={today}
              workouts={workouts}
              triggerClassName={SECTION_BUTTON_CLASSES}
            />
          </>
        )}
      </div>
    </section>
  );
}

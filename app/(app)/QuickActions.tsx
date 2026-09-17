import Link from "next/link";
import { getWorkoutsForUser } from "@/lib/workouts";
import LogPastSessionForm from "./_components/LogPastSessionForm";

type QuickActionsProps = {
  userId: string;
  today: string;
};

// docs/design/home.html's own quick-action buttons: padding 11px/14px,
// 9px radius (normalized to rounded-control per the approved radius
// normalization), 13px/500 text, ink-muted — left-aligned, not centred, and
// considerably smaller than a section's main button (PRIMARY_BUTTON_CLASSES
// elsewhere on this page). Not accent — this page's one accent primary
// action is already TodayHero's Start workout (see CLAUDE.md "Design": the
// accent is reserved for data and one primary action per view).
const QUICK_ACTION_CLASSES =
  "flex items-center justify-start rounded-control border border-hairline bg-surface-2 px-3.5 py-[11px] text-left text-[13px] font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/**
 * Home's two quick actions: New workout (a plain Link to
 * /workouts/new?from=home — the `from` param sends /workouts/new's BackLink
 * back to Home instead of its default /workouts, since this is the second
 * entry point that page now has) and Log a past session
 * (LogPastSessionForm's no-known-workoutId branch, built for this entry
 * point but left unwired until now — see that component's own doc comment).
 * Both render at the design's own compact size (QUICK_ACTION_CLASSES above),
 * not the app's larger main-section-button treatment — this is a list of
 * shortcuts, not a hero.
 * `getWorkoutsForUser(userId, { sort: "title" })` matches WorkoutPicker's
 * own doc comment: a user's own workout list is small enough for a plain
 * alphabetical <select>, no grouping needed. A third action was considered
 * and dropped (docs/GOHYBRID_PLAN.md §5A) — this section stays exactly two
 * buttons.
 */
export default async function QuickActions({
  userId,
  today,
}: QuickActionsProps) {
  const workouts = await getWorkoutsForUser(userId, { sort: "title" });

  return (
    <section className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface-1 p-5">
      <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">
        Quick actions
      </h2>
      <div className="flex flex-col gap-2">
        <Link href="/workouts/new?from=home" className={QUICK_ACTION_CLASSES}>
          New workout
        </Link>
        <LogPastSessionForm
          today={today}
          workouts={workouts.map((workout) => ({
            id: workout.id,
            title: workout.title,
          }))}
          triggerClassName={QUICK_ACTION_CLASSES}
        />
      </div>
    </section>
  );
}

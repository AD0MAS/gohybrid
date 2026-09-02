import { X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { computeGoalProgress, getGoalsForUser, resolveGoalCurrentValue } from "@/lib/goals";
import { getDistinctCustomNamesForUser } from "@/lib/personal-records";
import { getUserContext } from "@/lib/user-settings";
import GoalFields from "./GoalFields";
import { formatGoalValueText, getGoalSubjectLabel, GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS } from "./goal-labels";
import { deleteGoal, setGoalArchived } from "./goals-actions";

/**
 * Active goals with a resolved current value and progress bar each, plus
 * archived goals collapsed behind a native `<details>` disclosure — no
 * client JavaScript needed for that toggle. Fetches its own data given
 * `userId` via requireUser(), same self-fetching convention as
 * PersonalRecordsList/BodyMetricsList. Archived goals skip the
 * current-value resolution (and so show no progress bar): they're hidden
 * by default and their progress isn't the point once archived. A
 * body_metric/personal_record goal whose source has no rows yet resolves to
 * `null` (see resolveGoalCurrentValue) rather than a fabricated 0 — this
 * renders as a "no data yet" line with no progress bar, instead of the
 * misleading 100% a decrease goal's (start - 0) / (start - target) would
 * otherwise compute. Both
 * "today" and the source queries' timezone come from getUserContext
 * (cached, so this and EventsList/BodyMetricForm/PersonalRecordForm share
 * one pair of queries per request). Each row's Edit trigger embeds a
 * GoalFields instance directly (entry={goal}) rather than lifting a single
 * shared modal's state up into a client wrapper — GoalFields already owns
 * its own open/close state and useActionState call, so one instance per
 * row needs no coordination between rows and keeps this list a plain
 * Server Component. `catalog` is fetched here (not just in GoalForm) so
 * every row's embedded GoalFields has what it needs for personal_record
 * goals, same as GoalForm's own fetch.
 */
export default async function GoalsList() {
  const user = await requireUser();
  const [allGoals, catalog, customNames, { today, timezone, unitSystem }] =
    await Promise.all([
      getGoalsForUser(user.id, true),
      getExerciseCatalog(),
      getDistinctCustomNamesForUser(user.id),
      getUserContext(user.id),
    ]);

  const activeGoals = allGoals.filter((g) => !g.isArchived);
  const archivedGoals = allGoals.filter((g) => g.isArchived);

  if (allGoals.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
        No goals yet. Add one above to start tracking.
      </p>
    );
  }

  const activeWithProgress = await Promise.all(
    activeGoals.map(async (goal) => {
      const current = await resolveGoalCurrentValue(
        goal,
        user.id,
        today,
        timezone
      );
      return {
        goal,
        progress: current === null ? null : computeGoalProgress(goal, current),
      };
    })
  );

  return (
    <div className="flex flex-col gap-4">
      {activeGoals.length === 0 && (
        <p className="text-sm text-ink-subtle">No active goals.</p>
      )}

      {activeWithProgress.map(({ goal, progress }) => {
        const subject = getGoalSubjectLabel(goal);

        return (
          <div
            key={goal.id}
            className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{goal.title}</p>
                <p className="text-sm text-ink-subtle">
                  {GOAL_TYPE_LABELS[goal.goalType].label}
                  {subject ? ` · ${subject}` : ""} ·{" "}
                  {GOAL_PERIOD_LABELS[goal.period].label}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={setGoalArchived.bind(null, goal.id, true)}>
                  <button
                    type="submit"
                    className="flex h-8 items-center justify-center rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                  >
                    Archive
                  </button>
                </form>
                <GoalFields
                  catalog={catalog}
                  customNames={customNames}
                  unitSystem={unitSystem}
                  entry={goal}
                />
                <form action={deleteGoal.bind(null, goal.id)}>
                  <button
                    type="submit"
                    aria-label="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>

            {progress === null ? (
              <p className="text-sm text-ink-subtle">
                No data yet for this goal.
              </p>
            ) : (
              <>
                {(() => {
                  const roundedPercent = Math.round(progress.percent);
                  const isComplete = roundedPercent >= 100;

                  return (
                    <>
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span>
                          {formatGoalValueText(goal, progress.current, unitSystem)} /{" "}
                          {formatGoalValueText(goal, progress.target, unitSystem)}
                        </span>
                        <span className={isComplete ? "text-success" : "text-ink-subtle"}>
                          {roundedPercent}%
                        </span>
                      </p>

                      <div className="h-2 w-full rounded bg-surface-2">
                        <div
                          className={`h-2 rounded ${isComplete ? "bg-success" : "bg-accent"}`}
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        );
      })}

      {archivedGoals.length > 0 && (
        <details className="rounded-lg border border-hairline">
          <summary className="cursor-pointer p-3 text-sm text-ink-subtle">
            Archived goals ({archivedGoals.length})
          </summary>
          <div className="flex flex-col gap-2 p-3 pt-0">
            {archivedGoals.map((goal) => {
              const targetText = formatGoalValueText(goal, goal.targetValue, unitSystem);
              const subject = getGoalSubjectLabel(goal);

              return (
                <div
                  key={goal.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-1 p-5"
                >
                  <div>
                    <p className="text-sm">{goal.title}</p>
                    <p className="text-sm text-ink-subtle">
                      {GOAL_TYPE_LABELS[goal.goalType].label}
                      {subject ? ` · ${subject}` : ""} · Target {targetText}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={setGoalArchived.bind(null, goal.id, false)}>
                      <button
                        type="submit"
                        className="flex h-8 items-center justify-center rounded-md border border-hairline bg-surface-1 px-3 text-sm text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                      >
                        Unarchive
                      </button>
                    </form>
                    <form action={deleteGoal.bind(null, goal.id)}>
                      <button
                        type="submit"
                        aria-label="Delete"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

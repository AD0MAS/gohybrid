import { requireUser } from "@/lib/auth";
import { computeGoalProgress, getGoalsForUser, resolveGoalCurrentValue } from "@/lib/goals";
import { getUserContext } from "@/lib/user-settings";
import { getGoalSubjectLabel, getGoalUnit, GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS } from "./goal-labels";
import { deleteGoal, setGoalArchived } from "./goals-actions";

/**
 * Active goals with a resolved current value and progress bar each, plus
 * archived goals collapsed behind a native `<details>` disclosure — no
 * client JavaScript needed for that toggle. Fetches its own data given
 * `userId` via requireUser(), same self-fetching convention as
 * PersonalRecordsList/BodyMetricsList. Archived goals skip the
 * current-value resolution (and so show no progress bar): they're hidden
 * by default and their progress isn't the point once archived. Both
 * "today" and the source queries' timezone come from getUserContext
 * (cached, so this and EventsList/BodyMetricForm/PersonalRecordForm share
 * one pair of queries per request).
 */
export default async function GoalsList() {
  const user = await requireUser();
  const [allGoals, { today, timezone }] = await Promise.all([
    getGoalsForUser(user.id, true),
    getUserContext(user.id),
  ]);

  const activeGoals = allGoals.filter((g) => !g.isArchived);
  const archivedGoals = allGoals.filter((g) => g.isArchived);

  if (allGoals.length === 0) {
    return (
      <p className="text-sm text-gray-600">
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
      return { goal, progress: computeGoalProgress(goal, current) };
    })
  );

  return (
    <div className="flex flex-col gap-4">
      {activeGoals.length === 0 && (
        <p className="text-sm text-gray-600">No active goals.</p>
      )}

      {activeWithProgress.map(({ goal, progress }) => {
        const unit = getGoalUnit(goal);
        const subject = getGoalSubjectLabel(goal);

        return (
          <div
            key={goal.id}
            className="flex flex-col gap-2 rounded border border-gray-300 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{goal.title}</p>
                <p className="text-sm text-gray-600">
                  {GOAL_TYPE_LABELS[goal.goalType].label}
                  {subject ? ` · ${subject}` : ""} ·{" "}
                  {GOAL_PERIOD_LABELS[goal.period].label}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={setGoalArchived.bind(null, goal.id, true)}>
                  <button type="submit" className="text-sm text-gray-600 underline">
                    Archive
                  </button>
                </form>
                <form action={deleteGoal.bind(null, goal.id)}>
                  <button type="submit" className="text-sm text-red-700 underline">
                    Delete
                  </button>
                </form>
              </div>
            </div>

            <p className="text-sm">
              {progress.current} / {progress.target} {unit}
            </p>

            <div className="h-2 w-full rounded bg-gray-200">
              <div
                className="h-2 rounded bg-black"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        );
      })}

      {archivedGoals.length > 0 && (
        <details className="rounded border border-gray-200">
          <summary className="cursor-pointer p-3 text-sm text-gray-600">
            Archived goals ({archivedGoals.length})
          </summary>
          <div className="flex flex-col gap-2 p-3 pt-0">
            {archivedGoals.map((goal) => {
              const unit = getGoalUnit(goal);
              const subject = getGoalSubjectLabel(goal);

              return (
                <div
                  key={goal.id}
                  className="flex items-center justify-between gap-2 rounded border border-gray-200 p-3"
                >
                  <div>
                    <p className="text-sm">{goal.title}</p>
                    <p className="text-sm text-gray-600">
                      {GOAL_TYPE_LABELS[goal.goalType].label}
                      {subject ? ` · ${subject}` : ""} · Target{" "}
                      {goal.targetValue} {unit}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={setGoalArchived.bind(null, goal.id, false)}>
                      <button
                        type="submit"
                        className="text-sm text-gray-600 underline"
                      >
                        Unarchive
                      </button>
                    </form>
                    <form action={deleteGoal.bind(null, goal.id)}>
                      <button
                        type="submit"
                        className="text-sm text-red-700 underline"
                      >
                        Delete
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

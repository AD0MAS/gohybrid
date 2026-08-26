import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bodyMetricTypeEnum,
  goalDirectionEnum,
  goalPeriodEnum,
  goalTypeEnum,
  goals,
  personalRecordTypeEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import {
  getSessionCountForUserInRange,
  getSessionCountsByPrimaryTypeForUser,
  getStreaksForUser,
} from "./activity";
import { getBodyMetricsForUser } from "./body-metrics";
import {
  getPersonalRecordsForUser,
  groupPersonalRecordsBySubject,
  subjectKey,
} from "./personal-records";
import { getFirstDayOfMonth, getMondayOfWeek, getMonthString } from "./dates";
import type { ValidatedGoalInput } from "./goals-validation";

export type Goal = {
  id: string;
  userId: string;
  title: string;
  goalType: (typeof goalTypeEnum.enumValues)[number];
  direction: (typeof goalDirectionEnum.enumValues)[number];
  period: (typeof goalPeriodEnum.enumValues)[number];
  targetValue: number;
  startValue: number | null;
  targetPrimaryType: (typeof workoutPrimaryTypeEnum.enumValues)[number] | null;
  targetMetricType: (typeof bodyMetricTypeEnum.enumValues)[number] | null;
  targetExerciseId: string | null;
  targetCustomName: string | null;
  targetRecordType: (typeof personalRecordTypeEnum.enumValues)[number] | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  exercise: { id: string; name: string } | null;
};

/**
 * Drizzle returns `numeric` columns as strings (see GOHYBRID_PLAN.md §6),
 * so every row read from goals is mapped through this to give callers
 * actual numbers for targetValue/startValue.
 */
function toGoal(
  row: typeof goals.$inferSelect & {
    exercise: { id: string; name: string } | null;
  }
): Goal {
  return {
    ...row,
    targetValue: Number(row.targetValue),
    startValue: row.startValue === null ? null : Number(row.startValue),
  };
}

/**
 * Lists `userId`'s goals, most recently created first, each with its
 * related exercise nested in one query (only present for personal_record
 * goals targeting a catalog exercise). Archived goals are excluded unless
 * `includeArchived` is true. `userId` is a required first parameter, not
 * read from a session internally — with RLS disabled, this filter is the
 * only thing preventing one user from reading another user's goals.
 */
export async function getGoalsForUser(
  userId: string,
  includeArchived = false
): Promise<Goal[]> {
  const rows = await db.query.goals.findMany({
    where: (goals, { eq, and }) =>
      includeArchived
        ? eq(goals.userId, userId)
        : and(eq(goals.userId, userId), eq(goals.isArchived, false)),
    orderBy: (goals, { desc }) => [desc(goals.createdAt)],
    with: {
      exercise: {
        columns: { id: true, name: true },
      },
    },
  });

  return rows.map(toGoal);
}

/**
 * Creates one goal for `userId`. `input` is already validated (see
 * validateGoalInput in lib/goals-validation.ts); numeric fields are
 * converted to strings on the way in, since Drizzle's `numeric` columns are
 * written as strings.
 */
export async function createGoalForUser(
  userId: string,
  input: ValidatedGoalInput
): Promise<Goal> {
  const [created] = await db
    .insert(goals)
    .values({
      userId,
      title: input.title,
      goalType: input.goalType,
      direction: input.direction,
      period: input.period,
      targetValue: String(input.targetValue),
      startValue: input.startValue === null ? null : String(input.startValue),
      targetPrimaryType: input.targetPrimaryType,
      targetMetricType: input.targetMetricType,
      targetExerciseId: input.targetExerciseId,
      targetCustomName: input.targetCustomName,
      targetRecordType: input.targetRecordType,
    })
    .returning();

  const exercise = input.targetExerciseId
    ? await db.query.exercises.findFirst({
        where: (exercises, { eq }) => eq(exercises.id, input.targetExerciseId!),
        columns: { id: true, name: true },
      })
    : null;

  return toGoal({ ...created, exercise: exercise ?? null });
}

/**
 * Deletes a goal owned by `userId`, returning true if a row was deleted and
 * false otherwise — whether because the id doesn't exist or because it
 * belongs to a different user. Ownership is enforced in the WHERE clause,
 * same pattern as deletePersonalRecordForUser/deleteBodyMetricForUser.
 */
export async function deleteGoalForUser(
  id: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning({ id: goals.id });

  return deleted.length > 0;
}

/**
 * Sets `isArchived` on a goal owned by `userId`, returning true if a row
 * was updated and false otherwise. Ownership is enforced in the WHERE
 * clause, same pattern as the other per-user mutations in this file.
 */
export async function setGoalArchivedForUser(
  id: string,
  userId: string,
  isArchived: boolean
): Promise<boolean> {
  const updated = await db
    .update(goals)
    .set({ isArchived })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning({ id: goals.id });

  return updated.length > 0;
}

export type GoalProgress = {
  current: number;
  target: number;
  percent: number;
};

/**
 * Pure progress computation for one goal given its already-resolved
 * `currentValue` — no DB access, same principle as computeStreaks
 * (lib/activity.ts) and isBetterRecord (lib/personal-records.ts): the
 * arithmetic can be reasoned about and tested on its own. `percent` is
 * clamped to 0..100 so an overshoot (current past target) or an
 * as-yet-unstarted goal both render sensibly as a progress bar width.
 *
 *   - increase: current / target.
 *   - decrease: (start - current) / (start - target).
 *
 * Both denominators are guarded against zero: an "increase" goal with
 * target_value 0 (rejected by validateGoalInput, but this function must be
 * reasonable on its own) and a "decrease" goal whose start_value equals
 * target_value (also rejected at input time, same reasoning) both report
 * 0% rather than dividing by zero.
 */
export function computeGoalProgress(
  goal: Pick<Goal, "direction" | "targetValue" | "startValue">,
  currentValue: number
): GoalProgress {
  const { direction, targetValue: target, startValue } = goal;

  let ratio: number;
  if (direction === "increase") {
    ratio = target === 0 ? 0 : currentValue / target;
  } else {
    const start = startValue ?? target;
    const denominator = start - target;
    ratio = denominator === 0 ? 0 : (start - currentValue) / denominator;
  }

  const percent = Math.min(100, Math.max(0, ratio * 100));
  return { current: currentValue, target, percent };
}

/**
 * Resolves the sentinel range for goals with period "all_time": every
 * session/metric/record a user could have predates today by definition, so
 * a fixed far-past `from` reuses the existing range-based queries instead
 * of writing separate unbounded ones. `0001-01-01` is Postgres `date`'s
 * safe minimum for this purpose (its true minimum is 4713 BC, but no real
 * row will ever be that old either way).
 */
const ALL_TIME_START = "0001-01-01";

/**
 * Resolves a goal's period into a `{ from, to }` day range, `to` always
 * being `today`. Shared by resolveGoalCurrentValue for goal_type
 * "session_count" — the only goal_type whose current value is period-aware
 * (streak ignores period; body_metric/personal_record read the latest
 * value regardless of period).
 */
function resolveGoalPeriodRange(
  period: (typeof goalPeriodEnum.enumValues)[number],
  today: string
): { from: string; to: string } {
  switch (period) {
    case "week":
      return { from: getMondayOfWeek(today), to: today };
    case "month":
      return { from: getFirstDayOfMonth(getMonthString(today)), to: today };
    case "all_time":
      return { from: ALL_TIME_START, to: today };
  }
}

/**
 * Resolves a goal's current value from the source its goal_type points at,
 * calling the existing lib/activity.ts, lib/body-metrics.ts and
 * lib/personal-records.ts queries rather than duplicating any of them:
 *
 *   - session_count: getSessionCountForUserInRange over the goal's period
 *     when no targetPrimaryType is set; getSessionCountsByPrimaryTypeForUser
 *     over the same range, picking out the matching type's count (0 if
 *     that type has no sessions in range), when one is set.
 *   - streak: getStreaksForUser's current streak. period is ignored — a
 *     streak is inherently "as of today," not bounded to a week or month.
 *   - body_metric: the most recent body_metrics value for
 *     targetMetricType, via getBodyMetricsForUser(userId, metricType),
 *     which already returns newest-first; 0 when there's no measurement
 *     yet.
 *   - personal_record: the current best for the matching subject +
 *     targetRecordType, found via groupPersonalRecordsBySubject and the
 *     same subjectKey format personal-records.ts's own grouping uses; 0
 *     when there's no record for that subject yet.
 *
 * `timezone` is the user's own (see getUserSettings in
 * lib/user-settings.ts), threaded through to the two goal_types whose
 * source queries bucket workout_sessions by calendar day.
 */
export async function resolveGoalCurrentValue(
  goal: Goal,
  userId: string,
  today: string,
  timezone: string
): Promise<number> {
  switch (goal.goalType) {
    case "session_count": {
      const { from, to } = resolveGoalPeriodRange(goal.period, today);
      if (goal.targetPrimaryType === null) {
        return getSessionCountForUserInRange(userId, from, to, timezone);
      }
      const counts = await getSessionCountsByPrimaryTypeForUser(
        userId,
        from,
        to,
        timezone
      );
      return (
        counts.find((c) => c.primaryType === goal.targetPrimaryType)
          ?.count ?? 0
      );
    }
    case "streak": {
      const { current } = await getStreaksForUser(userId, today, timezone);
      return current;
    }
    case "body_metric": {
      const metrics = await getBodyMetricsForUser(
        userId,
        goal.targetMetricType!
      );
      return metrics[0]?.value ?? 0;
    }
    case "personal_record": {
      const records = await getPersonalRecordsForUser(userId);
      const groups = groupPersonalRecordsBySubject(records);
      const key = subjectKey({
        exerciseId: goal.targetExerciseId,
        customName: goal.targetCustomName,
        recordType: goal.targetRecordType!,
      });
      return groups.find((g) => g.subjectKey === key)?.best.value ?? 0;
    }
  }
}

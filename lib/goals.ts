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
  type PrimaryTypeSessionCount,
} from "./activity";
import { getBodyMetricsForUser, type BodyMetric } from "./body-metrics";
import { getPersonalRecordsForUser } from "./personal-records";
import {
  groupPersonalRecordsBySubject,
  subjectKey,
  type PersonalRecordGroup,
} from "./personal-records-grouping";
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
  exercise: { id: string; name: string; isHyroxStation: boolean } | null;
};

/**
 * Drizzle returns `numeric` columns as strings (see GOHYBRID_PLAN.md §6),
 * so every row read from goals is mapped through this to give callers
 * actual numbers for targetValue/startValue.
 */
function toGoal(
  row: typeof goals.$inferSelect & {
    exercise: { id: string; name: string; isHyroxStation: boolean } | null;
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
        columns: { id: true, name: true, isHyroxStation: true },
      },
    },
  });

  return rows.map(toGoal);
}

/**
 * Fetches one goal owned by `userId`, or null if it doesn't exist or belongs
 * to someone else — same ownership pattern as every other per-user query in
 * this file. updateGoal (goals-actions.ts) uses this to read the goal's
 * current target_* fields and direction before overwriting them, so it can
 * tell whether the edit changed what the goal targets (and therefore whether
 * start_value needs re-capturing) rather than just what it's called.
 */
export async function getGoalForUser(
  id: string,
  userId: string
): Promise<Goal | null> {
  const row = await db.query.goals.findFirst({
    where: (goals, { eq, and }) => and(eq(goals.id, id), eq(goals.userId, userId)),
    with: {
      exercise: {
        columns: { id: true, name: true, isHyroxStation: true },
      },
    },
  });

  return row ? toGoal(row) : null;
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
        columns: { id: true, name: true, isHyroxStation: true },
      })
    : null;

  return toGoal({ ...created, exercise: exercise ?? null });
}

/**
 * Updates a goal owned by `userId`, returning the updated Goal or null if
 * nothing matched — whether because the id doesn't exist or because it
 * belongs to a different user. Ownership is enforced in the WHERE clause,
 * same pattern as deleteGoalForUser. `input` is already validated — an
 * update has the same rules as a create (see validateGoalInput), and the
 * write shape mirrors createGoalForUser's exactly.
 */
export async function updateGoalForUser(
  id: string,
  userId: string,
  input: ValidatedGoalInput
): Promise<Goal | null> {
  const [updated] = await db
    .update(goals)
    .set({
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
    .where(and(eq(goals.id, id), eq(goals.userId, userId)))
    .returning();

  if (!updated) return null;

  const exercise = input.targetExerciseId
    ? await db.query.exercises.findFirst({
        where: (exercises, { eq }) => eq(exercises.id, input.targetExerciseId!),
        columns: { id: true, name: true, isHyroxStation: true },
      })
    : null;

  return toGoal({ ...updated, exercise: exercise ?? null });
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
 * (lib/activity.ts) and isBetterRecord (lib/personal-records-grouping.ts): the
 * arithmetic can be reasoned about and tested on its own. `percent` is
 * clamped to 0..100 so an overshoot (current past target) or an
 * as-yet-unstarted goal both render sensibly as a progress bar width.
 *
 *   - increase: current / target.
 *   - decrease: (start - current) / (start - target).
 *
 * The decrease branch reports 100% outright whenever currentValue has
 * already reached target (current <= target), before any division — past
 * that point the ratio's sign flips (current keeps falling below target
 * while start stays fixed above it) and would otherwise render as 0%
 * instead of "done". This is still needed even though goal creation now
 * rejects an already-met goal outright (see checkGoalNotAlreadyMet in
 * goals-actions.ts): reaching target *after* creation is the normal, whole
 * point of a goal, and must render 100%, not fall back through the ratio
 * below.
 *
 * The remaining denominator is guarded against zero: an "increase" goal
 * with target_value 0 (rejected by validateGoalInput, but this function
 * must be reasonable on its own) and a "decrease" goal whose start_value
 * equals target_value (also rejected at input time, same reasoning) both
 * report 0% rather than dividing by zero.
 */
export function computeGoalProgress(
  goal: Pick<Goal, "direction" | "targetValue" | "startValue">,
  currentValue: number
): GoalProgress {
  const { direction, targetValue: target, startValue } = goal;

  let ratio: number;
  if (direction === "increase") {
    ratio = target === 0 ? 0 : currentValue / target;
  } else if (currentValue <= target) {
    ratio = 1;
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
 * being `today`. Shared by resolveCurrentValueForTarget and
 * resolveGoalCurrentValues for goal_type "session_count" — the only
 * goal_type whose current value is period-aware (streak ignores period;
 * body_metric/personal_record read the latest value regardless of period).
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
 * The subset of a goal's fields that determine which source
 * resolveCurrentValueForTarget reads from — everything needed to resolve a
 * current value except the fields that only matter once a Goal row exists
 * (id, direction, targetValue, startValue). Letting addGoal/updateGoal build
 * one of these from freshly validated form input (before any row exists) is
 * the reason this is split out from Goal at all: those actions need to
 * resolve a start_value for a goal that isn't in the database yet.
 */
export type GoalTarget = Pick<
  Goal,
  | "goalType"
  | "period"
  | "targetPrimaryType"
  | "targetMetricType"
  | "targetExerciseId"
  | "targetCustomName"
  | "targetRecordType"
>;

/**
 * Resolves a current value from the source a goal_type points at, calling
 * the existing lib/activity.ts, lib/body-metrics.ts and
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
 *     which already returns newest-first; null when there's no measurement
 *     yet.
 *   - personal_record: the current best for the matching subject +
 *     targetRecordType, found via groupPersonalRecordsBySubject and the
 *     same subjectKey format personal-records-grouping.ts's own grouping uses; null
 *     when there's no record for that subject yet.
 *
 * body_metric/personal_record return null rather than 0 for "no data yet" —
 * 0 is a real value some other goal could legitimately have (0 sessions
 * this week is a real state), but a body metric or personal record with no
 * rows at all has no current value to report, and treating that as 0 sent
 * a brand-new decrease goal's progress straight to 100% (see
 * computeGoalProgress: (start - 0) / (start - target) overshoots and
 * clamps). session_count and streak never have this ambiguity — zero
 * sessions or a zero-day streak is a real, current value, not an absence
 * of data — so they keep returning a number. Callers (GoalsList,
 * addGoal/updateGoal) decide what to do with null: GoalsList renders no
 * progress bar; addGoal/updateGoal reject a decrease goal outright, since
 * there's no starting point to capture.
 *
 * `timezone` is the user's own (see getUserSettings in
 * lib/user-settings.ts), threaded through to the two goal_types whose
 * source queries bucket workout_sessions by calendar day.
 */
export async function resolveCurrentValueForTarget(
  target: GoalTarget,
  userId: string,
  today: string,
  timezone: string
): Promise<number | null> {
  switch (target.goalType) {
    case "session_count": {
      const { from, to } = resolveGoalPeriodRange(target.period, today);
      if (target.targetPrimaryType === null) {
        return getSessionCountForUserInRange(userId, from, to, timezone);
      }
      const counts = await getSessionCountsByPrimaryTypeForUser(
        userId,
        from,
        to,
        timezone
      );
      return (
        counts.find((c) => c.primaryType === target.targetPrimaryType)
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
        target.targetMetricType!
      );
      return metrics[0]?.value ?? null;
    }
    case "personal_record": {
      const records = await getPersonalRecordsForUser(userId);
      const groups = groupPersonalRecordsBySubject(records);
      const key = subjectKey({
        exerciseId: target.targetExerciseId,
        customName: target.targetCustomName,
        recordType: target.targetRecordType!,
      });
      return groups.find((g) => g.subjectKey === key)?.best.value ?? null;
    }
  }
}

/**
 * Pre-fetched data resolveGoalValueFromSources needs, one bucket per
 * goal_type's source — each populated at most once per call to
 * resolveGoalCurrentValues, no matter how many goals in the batch reference
 * it. A bucket is `null`/empty when nothing in the batch needs it, so
 * resolveGoalCurrentValues never fetches a source no goal actually targets.
 */
type GoalCurrentValueSources = {
  /** Current streak length; present iff at least one goal_type "streak" goal is in the batch. period is ignored (see resolveCurrentValueForTarget), so this is one query for the whole batch, not one per streak goal. */
  streakCurrent: number | null;
  /** Every personal record, pre-grouped by subject; present iff at least one goal_type "personal_record" goal is in the batch — grouping the whole table once serves every such goal, however many distinct subjects they target. */
  personalRecordGroups: PersonalRecordGroup[] | null;
  /** Latest-first body metrics, keyed by metric_type — one entry per DISTINCT targetMetricType actually referenced by a goal_type "body_metric" goal, not one per goal. */
  bodyMetricsByType: Map<
    (typeof bodyMetricTypeEnum.enumValues)[number],
    BodyMetric[]
  >;
  /**
   * Per-primary-type session counts for a period's date range, keyed by
   * `period` — one entry per DISTINCT period actually referenced by a
   * goal_type "session_count" goal, not one per goal. Every session has
   * exactly one non-null primary_type, so these per-type counts partition
   * the full set for that range: summing them reproduces the unfiltered
   * total. That's why a goal with no targetPrimaryType reads from the same
   * entry as one filtered to a specific type, instead of needing a second,
   * separate getSessionCountForUserInRange query per period.
   */
  sessionCountsByPeriod: Map<
    (typeof goalPeriodEnum.enumValues)[number],
    PrimaryTypeSessionCount[]
  >;
};

/**
 * Pure per-goal resolution against already-fetched sources — the batched
 * counterpart to resolveCurrentValueForTarget's per-goal_type switch, same
 * branches but reading from GoalCurrentValueSources instead of awaiting a
 * query per call. No I/O of its own, same principle as computeStreaks and
 * isBetterRecord: kept separable from the fetching that feeds it (see
 * resolveGoalCurrentValues). Falls back to the same "no data" values
 * resolveCurrentValueForTarget does (0 for session_count, null for
 * body_metric/personal_record) — see that function's doc comment for why.
 */
function resolveGoalValueFromSources(
  target: GoalTarget,
  sources: GoalCurrentValueSources
): number | null {
  switch (target.goalType) {
    case "session_count": {
      const counts = sources.sessionCountsByPeriod.get(target.period) ?? [];
      if (target.targetPrimaryType === null) {
        return counts.reduce((sum, c) => sum + c.count, 0);
      }
      return (
        counts.find((c) => c.primaryType === target.targetPrimaryType)
          ?.count ?? 0
      );
    }
    case "streak":
      return sources.streakCurrent ?? 0;
    case "body_metric": {
      const metrics =
        sources.bodyMetricsByType.get(target.targetMetricType!) ?? [];
      return metrics[0]?.value ?? null;
    }
    case "personal_record": {
      const groups = sources.personalRecordGroups ?? [];
      const key = subjectKey({
        exerciseId: target.targetExerciseId,
        customName: target.targetCustomName,
        recordType: target.targetRecordType!,
      });
      return groups.find((g) => g.subjectKey === key)?.best.value ?? null;
    }
  }
}

/**
 * Resolves current values for every goal in `goals` at once, fetching each
 * shared source exactly once no matter how many goals reference it — the
 * batched replacement for GoalsList's old per-goal Promise.all (each call to
 * the removed resolveGoalCurrentValue redid a full fetch — streak history,
 * the whole personal_records table, a metric's whole history — even when
 * several goals shared the same source; see GOHYBRID_PLAN.md §9 step 37).
 * Returns a Map keyed by goal.id so callers can look up each goal's value
 * without re-deriving which source it came from.
 *
 * Only fetches what `goals` actually references — e.g. no personal_record
 * query at all when the batch has no personal_record goals. Queries run in
 * parallel via Promise.all, then every goal is resolved against the fetched
 * sources by the pure resolveGoalValueFromSources. Single-goal callers
 * (goals-actions.ts's checkGoalNotAlreadyMet, at goal create/update time)
 * have no batching to do and stay on resolveCurrentValueForTarget, unchanged.
 */
export async function resolveGoalCurrentValues(
  goals: Goal[],
  userId: string,
  today: string,
  timezone: string
): Promise<Map<string, number | null>> {
  const needsStreak = goals.some((g) => g.goalType === "streak");
  const needsPersonalRecords = goals.some(
    (g) => g.goalType === "personal_record"
  );
  const metricTypes = [
    ...new Set(
      goals
        .filter((g) => g.goalType === "body_metric")
        .map((g) => g.targetMetricType!)
    ),
  ];
  const periods = [
    ...new Set(
      goals.filter((g) => g.goalType === "session_count").map((g) => g.period)
    ),
  ];

  const [streakCurrent, personalRecordGroups, bodyMetricResults, sessionCountResults] =
    await Promise.all([
      needsStreak
        ? getStreaksForUser(userId, today, timezone).then((s) => s.current)
        : Promise.resolve(null),
      needsPersonalRecords
        ? getPersonalRecordsForUser(userId).then(groupPersonalRecordsBySubject)
        : Promise.resolve(null),
      Promise.all(
        metricTypes.map(async (metricType) => ({
          metricType,
          metrics: await getBodyMetricsForUser(userId, metricType),
        }))
      ),
      Promise.all(
        periods.map(async (period) => {
          const { from, to } = resolveGoalPeriodRange(period, today);
          return {
            period,
            counts: await getSessionCountsByPrimaryTypeForUser(
              userId,
              from,
              to,
              timezone
            ),
          };
        })
      ),
    ]);

  const sources: GoalCurrentValueSources = {
    streakCurrent,
    personalRecordGroups,
    bodyMetricsByType: new Map(
      bodyMetricResults.map((r) => [r.metricType, r.metrics])
    ),
    sessionCountsByPeriod: new Map(
      sessionCountResults.map((r) => [r.period, r.counts])
    ),
  };

  return new Map(
    goals.map((goal) => [goal.id, resolveGoalValueFromSources(goal, sources)])
  );
}

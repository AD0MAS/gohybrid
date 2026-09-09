import type { goalPeriodEnum, goalTypeEnum, unitSystemEnum } from "@/db/schema";
import {
  formatBodyMetricValue,
  formatPersonalRecordValue,
  formatPersonalRecordValueText,
} from "@/lib/units";
import { BODY_METRIC_LABELS } from "./body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import type { Goal } from "@/lib/goals";

type GoalType = (typeof goalTypeEnum.enumValues)[number];
type GoalPeriod = (typeof goalPeriodEnum.enumValues)[number];

/**
 * The subset of a Goal formatGoalValue/formatGoalValueText actually read —
 * narrower than the full `Goal` row so goals-actions.ts's
 * checkGoalNotAlreadyMet can format a rejection message from a goal that
 * doesn't exist as a row yet (creation-time validation), without fabricating
 * every other Goal field.
 */
export type GoalValueContext = Pick<
  Goal,
  "goalType" | "targetMetricType" | "targetRecordType" | "exercise"
>;

/**
 * Display label per goal_type enum value — the goal-type select and the
 * goal list both read from here, same pattern as PERSONAL_RECORD_LABELS.
 */
export const GOAL_TYPE_LABELS: Record<GoalType, { label: string }> = {
  session_count: { label: "Session count" },
  streak: { label: "Streak" },
  body_metric: { label: "Body metric" },
  personal_record: { label: "Personal record" },
};

/** Display label per goal_period enum value — the period select and the
 * goal list both read from here. */
export const GOAL_PERIOD_LABELS: Record<GoalPeriod, { label: string }> = {
  week: { label: "This week" },
  month: { label: "This month" },
  all_time: { label: "All time" },
};

/**
 * Formats one of a goal's values (its current progress, or its target) for
 * display, given the raw metric number computeGoalProgress produced —
 * never the other way round: computeGoalProgress's `percent` is computed
 * from the raw metric current/target and must never be recomputed from a
 * converted value. session_count is always
 * "sessions" and streak is always "days" (both unit-system-independent,
 * value carried through unchanged); body_metric and personal_record route
 * through lib/units.ts's formatters, the same ones the Body Metrics and
 * Personal Records sections use, so a unit can't read differently in two
 * places. Called separately for `current` and `target` rather than once
 * for "the goal's unit" — a distance personal_record's two values can
 * legitimately land in different display units (e.g. current 800 ft vs.
 * target 1.2 mi), since formatPersonalRecordValue's distance rule is
 * per-value.
 */
export function formatGoalValue(
  goal: GoalValueContext,
  rawValue: number,
  unitSystem: (typeof unitSystemEnum.enumValues)[number]
): { value: number; unit: string } {
  switch (goal.goalType) {
    case "session_count":
      return { value: rawValue, unit: "sessions" };
    case "streak":
      return { value: rawValue, unit: "days" };
    case "body_metric":
      return formatBodyMetricValue(goal.targetMetricType!, rawValue, unitSystem);
    case "personal_record":
      return formatPersonalRecordValue(
        goal.targetRecordType!,
        rawValue,
        unitSystem,
        goal.exercise?.isHyroxStation ?? false
      );
  }
}

/**
 * Text-ready version of formatGoalValue, for GoalsList's current/target
 * display. Delegates to formatPersonalRecordValueText for a
 * personal_record goal (the only goal_type whose value can be a duration —
 * see that function's comment for why "time" gets its own text path), and
 * to formatGoalValue's plain "value unit" join for the other three, none
 * of which are ever a duration. formatGoalValue itself is untouched and
 * keeps returning the raw numeric seconds for a time-record goal — GoalFields
 * still needs that number to seed DurationInput's defaultValueSeconds when
 * editing.
 */
export function formatGoalValueText(
  goal: GoalValueContext,
  rawValue: number,
  unitSystem: (typeof unitSystemEnum.enumValues)[number]
): string {
  if (goal.goalType === "personal_record") {
    return formatPersonalRecordValueText(
      goal.targetRecordType!,
      rawValue,
      unitSystem,
      goal.exercise?.isHyroxStation ?? false
    );
  }
  const { value, unit } = formatGoalValue(goal, rawValue, unitSystem);
  return `${value} ${unit}`;
}

/**
 * A goal's human-readable subject — what it's actually tracking, shown
 * alongside its title in the list. session_count optionally names a
 * primary type; body_metric names its metric; personal_record names its
 * exercise/custom name plus record type; streak has no further subject.
 */
export function getGoalSubjectLabel(goal: Goal): string | null {
  switch (goal.goalType) {
    case "session_count":
      return goal.targetPrimaryType ? goal.targetPrimaryType : null;
    case "streak":
      return null;
    case "body_metric":
      return BODY_METRIC_LABELS[goal.targetMetricType!].label;
    case "personal_record": {
      const subject = goal.exercise?.name ?? goal.targetCustomName ?? "Unknown";
      return `${subject} (${PERSONAL_RECORD_LABELS[goal.targetRecordType!].label})`;
    }
  }
}

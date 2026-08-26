import type { goalPeriodEnum, goalTypeEnum } from "@/db/schema";
import { BODY_METRIC_LABELS } from "./body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import type { Goal } from "@/lib/goals";

type GoalType = (typeof goalTypeEnum.enumValues)[number];
type GoalPeriod = (typeof goalPeriodEnum.enumValues)[number];

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
 * The unit a goal's current/target values are expressed in, derived from
 * its goal_type (and, for body_metric/personal_record goals, the specific
 * target it points at) rather than stored as its own column — a
 * session_count goal is always "sessions", a streak is always "days", and
 * the other two reuse the same label maps the Body Metrics and Personal
 * Records sections already use, so a unit can't read differently in two
 * places.
 */
export function getGoalUnit(goal: Goal): string {
  switch (goal.goalType) {
    case "session_count":
      return "sessions";
    case "streak":
      return "days";
    case "body_metric":
      return BODY_METRIC_LABELS[goal.targetMetricType!].unit;
    case "personal_record":
      return PERSONAL_RECORD_LABELS[goal.targetRecordType!].unit;
  }
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

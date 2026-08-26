import {
  bodyMetricTypeEnum,
  goalDirectionEnum,
  goalPeriodEnum,
  goalTypeEnum,
  personalRecordTypeEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import { isOneOf, isValidUuid } from "./workouts-validation";

export type ValidatedGoalInput = {
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
};

export type GoalValidationResult =
  | { success: true; data: ValidatedGoalInput }
  | { success: false; error: string };

/** Raw, untyped goal input as received from a FormData submission. */
export type RawGoalInput = {
  title?: unknown;
  goalType?: unknown;
  direction?: unknown;
  period?: unknown;
  targetValue?: unknown;
  startValue?: unknown;
  targetPrimaryType?: unknown;
  targetMetricType?: unknown;
  targetExerciseId?: unknown;
  targetCustomName?: unknown;
  targetRecordType?: unknown;
};

// Must match goals.target_value/start_value's numeric(9,2) in db/schema.ts —
// the largest value those columns can hold. Kept as a named constant so the
// two can't drift without someone noticing (same pattern as
// MAX_PERSONAL_RECORD_VALUE).
const MAX_GOAL_VALUE = 9999999.99;

function parseOptionalValue(
  raw: unknown
): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_GOAL_VALUE) {
    return { ok: false };
  }
  return { ok: true, value: Math.round(parsed * 100) / 100 };
}

/**
 * Validates and normalizes goal input, same (input) => result shape as
 * validatePersonalRecordInput/validateBodyMetricInput minus their `today`
 * parameter — unlike a body metric or personal record, a goal carries no
 * date field, so there's no "not in the future" rule to judge against
 * today here. Rules, per §5 Layer 4 / the goals schema comment in
 * db/schema.ts:
 *   - title required, trimmed.
 *   - targetValue positive, <= MAX_GOAL_VALUE, rounded to 2 decimals.
 *   - direction "decrease" requires startValue, and startValue must differ
 *     from targetValue (a zero-length decrease has no meaningful progress
 *     denominator — see computeGoalProgress in lib/goals.ts).
 *   - goal_type "body_metric" requires targetMetricType and rejects every
 *     other target_* field.
 *   - goal_type "personal_record" requires targetRecordType plus exactly
 *     one of targetExerciseId/targetCustomName (never both, never neither —
 *     the same rule validatePersonalRecordInput enforces for actual
 *     records), and rejects targetPrimaryType/targetMetricType.
 *   - goal_type "session_count" may optionally set targetPrimaryType, and
 *     rejects every other target_* field.
 *   - goal_type "streak" must have none of the target_* fields set.
 *   - goal_type "session_count" and "streak" must have direction
 *     "increase" — fewer sessions or a shorter streak is never the target,
 *     so "decrease" (and the startValue it would otherwise require) makes
 *     no sense for either.
 */
export function validateGoalInput(input: RawGoalInput): GoalValidationResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { success: false, error: "Title is required." };
  }

  const goalType = input.goalType;
  if (!isOneOf(goalType, goalTypeEnum.enumValues)) {
    return {
      success: false,
      error: `goalType must be one of: ${goalTypeEnum.enumValues.join(", ")}.`,
    };
  }

  const direction = input.direction;
  if (!isOneOf(direction, goalDirectionEnum.enumValues)) {
    return {
      success: false,
      error: `direction must be one of: ${goalDirectionEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const period = input.period;
  if (!isOneOf(period, goalPeriodEnum.enumValues)) {
    return {
      success: false,
      error: `period must be one of: ${goalPeriodEnum.enumValues.join(", ")}.`,
    };
  }

  const parsedTarget = parseOptionalValue(input.targetValue);
  if (!parsedTarget.ok || parsedTarget.value === null) {
    return {
      success: false,
      error: `targetValue must be between 0 and ${MAX_GOAL_VALUE}.`,
    };
  }
  const targetValue = parsedTarget.value;

  const parsedStart = parseOptionalValue(input.startValue);
  if (!parsedStart.ok) {
    return {
      success: false,
      error: `startValue must be between 0 and ${MAX_GOAL_VALUE}.`,
    };
  }
  const startValue = parsedStart.value;

  if (direction === "decrease") {
    if (startValue === null) {
      return {
        success: false,
        error: "startValue is required when direction is decrease.",
      };
    }
    if (startValue === targetValue) {
      return {
        success: false,
        error: "startValue must differ from targetValue.",
      };
    }
  }

  const rawTargetPrimaryType = input.targetPrimaryType;
  const targetPrimaryType =
    typeof rawTargetPrimaryType === "string" && rawTargetPrimaryType !== ""
      ? rawTargetPrimaryType
      : null;
  if (
    targetPrimaryType !== null &&
    !isOneOf(targetPrimaryType, workoutPrimaryTypeEnum.enumValues)
  ) {
    return {
      success: false,
      error: `targetPrimaryType must be one of: ${workoutPrimaryTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const rawTargetMetricType = input.targetMetricType;
  const targetMetricType =
    typeof rawTargetMetricType === "string" && rawTargetMetricType !== ""
      ? rawTargetMetricType
      : null;
  if (
    targetMetricType !== null &&
    !isOneOf(targetMetricType, bodyMetricTypeEnum.enumValues)
  ) {
    return {
      success: false,
      error: `targetMetricType must be one of: ${bodyMetricTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const rawExerciseId = input.targetExerciseId;
  const targetExerciseId =
    typeof rawExerciseId === "string" && rawExerciseId.trim() !== ""
      ? rawExerciseId.trim()
      : null;
  if (targetExerciseId !== null && !isValidUuid(targetExerciseId)) {
    return { success: false, error: "targetExerciseId must be a valid id." };
  }

  const rawCustomName = input.targetCustomName;
  const targetCustomName =
    typeof rawCustomName === "string" && rawCustomName.trim() !== ""
      ? rawCustomName.trim()
      : null;

  const rawTargetRecordType = input.targetRecordType;
  const targetRecordType =
    typeof rawTargetRecordType === "string" && rawTargetRecordType !== ""
      ? rawTargetRecordType
      : null;
  if (
    targetRecordType !== null &&
    !isOneOf(targetRecordType, personalRecordTypeEnum.enumValues)
  ) {
    return {
      success: false,
      error: `targetRecordType must be one of: ${personalRecordTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  switch (goalType) {
    case "session_count": {
      if (direction !== "increase") {
        return {
          success: false,
          error: "session_count and streak goals are always increase.",
        };
      }
      if (
        targetMetricType !== null ||
        targetExerciseId !== null ||
        targetCustomName !== null ||
        targetRecordType !== null
      ) {
        return {
          success: false,
          error:
            "session_count goals only accept an optional targetPrimaryType.",
        };
      }
      break;
    }
    case "streak": {
      if (direction !== "increase") {
        return {
          success: false,
          error: "session_count and streak goals are always increase.",
        };
      }
      if (
        targetPrimaryType !== null ||
        targetMetricType !== null ||
        targetExerciseId !== null ||
        targetCustomName !== null ||
        targetRecordType !== null
      ) {
        return {
          success: false,
          error: "streak goals accept none of the target_* fields.",
        };
      }
      break;
    }
    case "body_metric": {
      if (targetMetricType === null) {
        return {
          success: false,
          error: "body_metric goals require targetMetricType.",
        };
      }
      if (
        targetPrimaryType !== null ||
        targetExerciseId !== null ||
        targetCustomName !== null ||
        targetRecordType !== null
      ) {
        return {
          success: false,
          error: "body_metric goals only accept targetMetricType.",
        };
      }
      break;
    }
    case "personal_record": {
      if (targetRecordType === null) {
        return {
          success: false,
          error: "personal_record goals require targetRecordType.",
        };
      }
      if (targetExerciseId !== null && targetCustomName !== null) {
        return {
          success: false,
          error:
            "Choose either a catalog exercise or a custom name, not both.",
        };
      }
      if (targetExerciseId === null && targetCustomName === null) {
        return {
          success: false,
          error:
            "personal_record goals require either targetExerciseId or targetCustomName.",
        };
      }
      if (targetPrimaryType !== null || targetMetricType !== null) {
        return {
          success: false,
          error:
            "personal_record goals only accept targetRecordType and the exercise/custom-name choice.",
        };
      }
      break;
    }
  }

  return {
    success: true,
    data: {
      title,
      goalType,
      direction,
      period,
      targetValue,
      startValue,
      targetPrimaryType,
      targetMetricType,
      targetExerciseId,
      targetCustomName,
      targetRecordType,
    },
  };
}

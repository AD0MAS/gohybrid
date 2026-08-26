import { bodyMetricTypeEnum } from "@/db/schema";
import { isOneOf } from "./workouts-validation";
import { isValidDateString } from "./scheduled-workouts-validation";

export type ValidatedBodyMetricInput = {
  metricType: (typeof bodyMetricTypeEnum.enumValues)[number];
  value: number;
  measuredAt: string;
  notes: string | null;
};

export type BodyMetricValidationResult =
  | { success: true; data: ValidatedBodyMetricInput }
  | { success: false; error: string };

/** Raw, untyped body-metric input as received from a FormData submission. */
export type RawBodyMetricInput = {
  metricType?: unknown;
  value?: unknown;
  measuredAt?: unknown;
  notes?: unknown;
};

// Must match body_metrics.value's numeric(6,2) in db/schema.ts — the
// largest value that column can hold. Kept as a named constant so the two
// can't drift without someone noticing.
const MAX_BODY_METRIC_VALUE = 9999.99;

/**
 * Validates and normalizes body-metric input. Shared by the /profile
 * add-measurement Server Action and any future API surface, same pattern
 * as validateWorkoutInput/validateScheduleInput. Rules: metricType must be
 * one of the enum values defined in db/schema.ts; value must be a positive
 * finite number no greater than MAX_BODY_METRIC_VALUE (the DB constraint is
 * the last line of defence, not the first) and is rounded to 2 decimal
 * places here rather than left for Postgres to round silently; measuredAt
 * must be a YYYY-MM-DD date not later than `today` (passed in by the
 * caller — see getUserContext in lib/user-settings.ts — so "the future" is
 * judged against the user's own calendar day, not the application
 * server's clock or a fixed UTC one); notes, if present, is trimmed and
 * normalized to null when empty.
 */
export function validateBodyMetricInput(
  input: RawBodyMetricInput,
  today: string
): BodyMetricValidationResult {
  const metricType = input.metricType;
  if (!isOneOf(metricType, bodyMetricTypeEnum.enumValues)) {
    return {
      success: false,
      error: `metricType must be one of: ${bodyMetricTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const rawValue = input.value;
  const parsedValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue > MAX_BODY_METRIC_VALUE
  ) {
    return {
      success: false,
      error: `value must be between 0 and ${MAX_BODY_METRIC_VALUE}.`,
    };
  }
  const value = Math.round(parsedValue * 100) / 100;

  const measuredAt = input.measuredAt;
  if (!isValidDateString(measuredAt)) {
    return { success: false, error: "measuredAt must be a YYYY-MM-DD date." };
  }
  if (measuredAt > today) {
    return { success: false, error: "measuredAt can't be in the future." };
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;

  return {
    success: true,
    data: { metricType, value, measuredAt, notes },
  };
}

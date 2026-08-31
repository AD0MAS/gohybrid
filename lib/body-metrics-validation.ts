import { bodyMetricTypeEnum, unitSystemEnum } from "@/db/schema";
import { formatWeightKg } from "./units";
import {
  BODY_FAT_DIGIT_LIMIT,
  BODY_WEIGHT_DIGIT_LIMIT,
  checkDigitLimit,
  RESTING_HR_DIGIT_LIMIT,
} from "./numeric-limits";
import { isOneOf } from "./workouts-validation";
import { isValidDateString } from "./scheduled-workouts-validation";

type UnitSystem = (typeof unitSystemEnum.enumValues)[number];
type BodyMetricType = (typeof bodyMetricTypeEnum.enumValues)[number];

export type ValidatedBodyMetricInput = {
  metricType: BodyMetricType;
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

// One digit-limit + display label per metric_type, checked by
// checkDigitLimit (lib/numeric-limits.ts) below — replaces the old shared
// MAX_BODY_METRIC_VALUE bound, which reported every field's ceiling in kg
// even when the user typed lb. Weight's label is resolved per-call (it
// depends on unitSystem); the other two are unit-system-independent, same
// reasoning as formatBodyMetricValue in lib/units.ts.
function digitLimitFor(metricType: BodyMetricType, unitSystem: UnitSystem) {
  switch (metricType) {
    case "weight":
      return {
        limit: BODY_WEIGHT_DIGIT_LIMIT,
        label: `Weight (${formatWeightKg(0, unitSystem).unit})`,
      };
    case "body_fat":
      return { limit: BODY_FAT_DIGIT_LIMIT, label: "Body fat (%)" };
    case "resting_hr":
      return { limit: RESTING_HR_DIGIT_LIMIT, label: "Resting HR (bpm)" };
  }
}

/**
 * Validates and normalizes body-metric input. Shared by the /profile
 * add-measurement Server Action and any future API surface, same pattern
 * as validateWorkoutInput/validateScheduleInput. Rules: metricType must be
 * one of the enum values defined in db/schema.ts; value must be a
 * positive finite number within its metric_type's digit limit (see
 * digitLimitFor above — the numeric(6,2) column ceiling is now a
 * consequence of those limits rather than a separate check: every one of
 * them tops out at or under 9999.99, so nothing here can hand the column
 * a value it can't hold); measuredAt must be a YYYY-MM-DD date not later
 * than `today` (passed in by the caller — see getUserContext in
 * lib/user-settings.ts — so "the future" is judged against the user's own
 * calendar day, not the application server's clock or a fixed UTC one);
 * notes, if present, is trimmed and normalized to null when empty.
 *
 * `unitSystem` is only ever used to phrase the weight digit-limit message
 * in the unit the user actually typed (kg or lb) — `value` itself must
 * already be metric kg by the time it reaches this function (see
 * addBodyMetric/updateBodyMetric in body-metrics-actions.ts, which run
 * convertWeightInputToKg before calling this). The digit limit is checked
 * against that metric value either way; only the message's wording
 * changes with unitSystem, not the bound itself.
 */
export function validateBodyMetricInput(
  input: RawBodyMetricInput,
  today: string,
  unitSystem: UnitSystem
): BodyMetricValidationResult {
  const metricType = input.metricType;
  if (!isOneOf(metricType, bodyMetricTypeEnum.enumValues)) {
    return {
      success: false,
      error: `Metric type must be one of: ${bodyMetricTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const rawValue = input.value;
  const parsedValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const { limit, label } = digitLimitFor(metricType, unitSystem);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return { success: false, error: `${label} must be greater than 0.` };
  }
  const digitCheck = checkDigitLimit(parsedValue, limit, label);
  if (!digitCheck.ok) {
    return { success: false, error: digitCheck.error };
  }
  const value = digitCheck.value;

  const measuredAt = input.measuredAt;
  if (!isValidDateString(measuredAt)) {
    return {
      success: false,
      error: "Date measured must be a YYYY-MM-DD date.",
    };
  }
  if (measuredAt > today) {
    return { success: false, error: "Date measured can't be in the future." };
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

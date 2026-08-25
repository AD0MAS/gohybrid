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

/**
 * Validates and normalizes body-metric input. Shared by the /profile
 * add-measurement Server Action and any future API surface, same pattern
 * as validateWorkoutInput/validateScheduleInput. Rules: metricType must be
 * one of the enum values defined in db/schema.ts; value must be a positive
 * finite number; measuredAt must be a YYYY-MM-DD date not later than
 * `today` (passed in by the caller — see getCurrentDateString in
 * lib/scheduled-workouts.ts — so "the future" is judged against the
 * database's own notion of today, not the application server's clock);
 * notes, if present, is trimmed and normalized to null when empty.
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
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    return { success: false, error: "value must be a positive number." };
  }

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

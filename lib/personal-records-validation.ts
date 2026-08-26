import { personalRecordTypeEnum } from "@/db/schema";
import { isOneOf, isValidUuid } from "./workouts-validation";
import { isValidDateString } from "./scheduled-workouts-validation";

export type ValidatedPersonalRecordInput = {
  exerciseId: string | null;
  customName: string | null;
  recordType: (typeof personalRecordTypeEnum.enumValues)[number];
  value: number;
  achievedAt: string;
  notes: string | null;
};

export type PersonalRecordValidationResult =
  | { success: true; data: ValidatedPersonalRecordInput }
  | { success: false; error: string };

/** Raw, untyped personal-record input as received from a FormData submission. */
export type RawPersonalRecordInput = {
  exerciseId?: unknown;
  customName?: unknown;
  recordType?: unknown;
  value?: unknown;
  achievedAt?: unknown;
  notes?: unknown;
};

// Must match personal_records.value's numeric(9,2) in db/schema.ts — the
// largest value that column can hold. Kept as a named constant so the two
// can't drift without someone noticing.
const MAX_PERSONAL_RECORD_VALUE = 9999999.99;

/**
 * Validates and normalizes personal-record input, same pattern as
 * validateBodyMetricInput. Rules: exactly the exercise_id/custom_name
 * duality from workout_items — exactly one of exerciseId/customName must
 * be present, never neither and never both (the UI enforces this with a
 * single select, but the server is the actual gate); recordType must be
 * one of the enum values defined in db/schema.ts; value must be a positive
 * finite number no greater than MAX_PERSONAL_RECORD_VALUE (the DB
 * constraint is the last line of defence, not the first) and is rounded to
 * 2 decimal places here rather than left for Postgres to round silently;
 * achievedAt must be a YYYY-MM-DD date not later than `today` (passed in by
 * the caller, same ground truth as getUserContext elsewhere —
 * lib/user-settings.ts); notes, if present, is trimmed and normalized to
 * null when empty.
 */
export function validatePersonalRecordInput(
  input: RawPersonalRecordInput,
  today: string
): PersonalRecordValidationResult {
  const rawExerciseId = input.exerciseId;
  const exerciseId =
    typeof rawExerciseId === "string" && rawExerciseId.trim() !== ""
      ? rawExerciseId.trim()
      : null;
  if (exerciseId !== null && !isValidUuid(exerciseId)) {
    return { success: false, error: "exerciseId must be a valid id." };
  }

  const rawCustomName = input.customName;
  const customName =
    typeof rawCustomName === "string" && rawCustomName.trim() !== ""
      ? rawCustomName.trim()
      : null;

  if (exerciseId !== null && customName !== null) {
    return {
      success: false,
      error: "Choose either a catalog exercise or a custom name, not both.",
    };
  }

  if (exerciseId === null && customName === null) {
    return {
      success: false,
      error: "Either exerciseId or customName is required.",
    };
  }

  const recordType = input.recordType;
  if (!isOneOf(recordType, personalRecordTypeEnum.enumValues)) {
    return {
      success: false,
      error: `recordType must be one of: ${personalRecordTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const rawValue = input.value;
  const parsedValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue > MAX_PERSONAL_RECORD_VALUE
  ) {
    return {
      success: false,
      error: `value must be between 0 and ${MAX_PERSONAL_RECORD_VALUE}.`,
    };
  }
  const value = Math.round(parsedValue * 100) / 100;

  const achievedAt = input.achievedAt;
  if (!isValidDateString(achievedAt)) {
    return { success: false, error: "achievedAt must be a YYYY-MM-DD date." };
  }
  if (achievedAt > today) {
    return { success: false, error: "achievedAt can't be in the future." };
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;

  return {
    success: true,
    data: { exerciseId, customName, recordType, value, achievedAt, notes },
  };
}

import { personalRecordTypeEnum, unitSystemEnum } from "@/db/schema";
import { formatWeightKg } from "./units";
import {
  CALORIES_DIGIT_LIMIT,
  checkDigitLimit,
  DISTANCE_DIGIT_LIMIT,
  LIFTED_WEIGHT_DIGIT_LIMIT,
  REPS_DIGIT_LIMIT,
} from "./numeric-limits";
import { isOneOf, isValidUuid } from "./workouts-validation";
import { isValidDateString } from "./scheduled-workouts-validation";
import {
  checkTextLength,
  RECORD_CUSTOM_NAME_MAX_LENGTH,
  RECORD_NOTES_MAX_LENGTH,
} from "./text-limits";

type UnitSystem = (typeof unitSystemEnum.enumValues)[number];
type NonTimeRecordType = Exclude<
  (typeof personalRecordTypeEnum.enumValues)[number],
  "time"
>;

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

// One digit-limit + display label per non-"time" record_type, checked by
// checkDigitLimit (lib/numeric-limits.ts) below — replaces the old shared
// MAX_PERSONAL_RECORD_VALUE bound, which reported every field's ceiling in
// kg/metres even when the user typed lb or picked ft/mi. Weight's label is
// resolved per-call (it depends on unitSystem); distance is reported in
// metres regardless of unitSystem, because by the time a value reaches
// this function it's already gone through DistanceInput's own explicit
// unit <select> (never unitSystem) and convertDistanceInputToMetres
// (lib/units.ts) — there is no single "the user's unit" to name the way
// there is for weight, and the digit limit itself is checked against the
// metric value regardless. "time" has no entry here — see its own branch
// below.
function digitLimitFor(recordType: NonTimeRecordType, unitSystem: UnitSystem) {
  switch (recordType) {
    case "weight":
      return {
        limit: LIFTED_WEIGHT_DIGIT_LIMIT,
        label: `Weight (${formatWeightKg(0, unitSystem).unit})`,
      };
    case "reps":
      return { limit: REPS_DIGIT_LIMIT, label: "Reps" };
    case "calories":
      return { limit: CALORIES_DIGIT_LIMIT, label: "Calories" };
    case "distance":
      return { limit: DISTANCE_DIGIT_LIMIT, label: "Distance (m)" };
  }
}

/**
 * Validates and normalizes personal-record input, same pattern as
 * validateBodyMetricInput. Rules: exactly the exercise_id/custom_name
 * duality from workout_items — exactly one of exerciseId/customName must
 * be present, never neither and never both (the UI enforces this with a
 * single select, but the server is the actual gate); recordType must be
 * one of the enum values defined in db/schema.ts; a non-"time" value must
 * be a positive finite number within its record_type's digit limit (see
 * digitLimitFor above — the numeric(9,2) column ceiling is now a
 * consequence of those limits rather than a separate check: every one of
 * them tops out at or under 9999999.99, so nothing here can hand the
 * column a value it can't hold); achievedAt must be a YYYY-MM-DD date not
 * later than `today` (passed in by the caller, same ground truth as
 * getUserContext elsewhere — lib/user-settings.ts); notes, if present, is
 * trimmed and normalized to null when empty.
 *
 * `unitSystem` is only ever used to phrase the weight digit-limit message
 * in the unit the user actually typed (kg or lb) — `value` itself must
 * already be metric (kg, or metres for distance) by the time it reaches
 * this function (see addPersonalRecord/updatePersonalRecord in
 * personal-records-actions.ts, which convert before calling this). The
 * digit limit is checked against that metric value either way; only the
 * weight message's wording changes with unitSystem, not the bound itself.
 */
export function validatePersonalRecordInput(
  input: RawPersonalRecordInput,
  today: string,
  unitSystem: UnitSystem
): PersonalRecordValidationResult {
  const rawExerciseId = input.exerciseId;
  const exerciseId =
    typeof rawExerciseId === "string" && rawExerciseId.trim() !== ""
      ? rawExerciseId.trim()
      : null;
  if (exerciseId !== null && !isValidUuid(exerciseId)) {
    return { success: false, error: "Exercise must be a valid selection." };
  }

  const rawCustomName = input.customName;
  const customName =
    typeof rawCustomName === "string" && rawCustomName.trim() !== ""
      ? rawCustomName.trim()
      : null;
  if (customName !== null) {
    const customNameCheck = checkTextLength(
      customName,
      RECORD_CUSTOM_NAME_MAX_LENGTH,
      "Custom name"
    );
    if (!customNameCheck.ok) {
      return { success: false, error: customNameCheck.error };
    }
  }

  if (exerciseId !== null && customName !== null) {
    return {
      success: false,
      error: "Choose either a catalog exercise or a custom name, not both.",
    };
  }

  if (exerciseId === null && customName === null) {
    return {
      success: false,
      error: "Either an exercise or a custom name is required.",
    };
  }

  const recordType = input.recordType;
  if (!isOneOf(recordType, personalRecordTypeEnum.enumValues)) {
    return {
      success: false,
      error: `Record type must be one of: ${personalRecordTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  // record_type "time" is entered through DurationInput as composed
  // whole seconds, not a typed number — no meaningful upper bound to
  // report, just "required" (missing) vs. "must be more than zero"
  // (present but every box left at 00, which composes to 0, not blank).
  const rawValue = input.value;
  let value: number;
  if (recordType === "time") {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return { success: false, error: "Value is required." };
    }
    const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue);
    const rounded = Math.round(parsed);
    if (!Number.isFinite(parsed) || rounded <= 0) {
      return { success: false, error: "Value must be more than zero." };
    }
    value = rounded;
  } else {
    const parsedValue =
      typeof rawValue === "number" ? rawValue : Number(rawValue);
    const { limit, label } = digitLimitFor(recordType, unitSystem);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return { success: false, error: `${label} must be greater than 0.` };
    }
    const digitCheck = checkDigitLimit(parsedValue, limit, label);
    if (!digitCheck.ok) {
      return { success: false, error: digitCheck.error };
    }
    value = digitCheck.value;
  }

  const achievedAt = input.achievedAt;
  if (!isValidDateString(achievedAt)) {
    return {
      success: false,
      error: "Date achieved must be a YYYY-MM-DD date.",
    };
  }
  if (achievedAt > today) {
    return { success: false, error: "Date achieved can't be in the future." };
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;
  if (notes !== null) {
    const notesCheck = checkTextLength(notes, RECORD_NOTES_MAX_LENGTH, "Notes");
    if (!notesCheck.ok) {
      return { success: false, error: notesCheck.error };
    }
  }

  return {
    success: true,
    data: { exerciseId, customName, recordType, value, achievedAt, notes },
  };
}

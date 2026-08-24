import { isValidUuid } from "./workouts-validation";

export type ValidatedScheduleInput = {
  workoutId: string;
  scheduledDate: string;
  scheduledTime: string | null;
  notes: string | null;
};

export type ScheduleValidationResult =
  | { success: true; data: ValidatedScheduleInput }
  | { success: false; error: string };

/** Raw, untyped scheduling input as received from either a JSON request
 * body or a FormData submission. */
export type RawScheduleInput = {
  workoutId?: unknown;
  scheduledDate?: unknown;
  scheduledTime?: unknown;
  notes?: unknown;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

/**
 * Checks whether a value is a syntactically valid ISO calendar date
 * (YYYY-MM-DD) — the string shape a Postgres `date` column round-trips as
 * through Drizzle. Doesn't check that the date is a real calendar day
 * (e.g. 2024-02-30); an invalid one is rejected by Postgres itself at
 * insert time.
 */
export function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && DATE_REGEX.test(value);
}

/**
 * Checks whether a value is a syntactically valid 24-hour clock time,
 * either HH:MM (the format an `<input type="time">` submits) or HH:MM:SS
 * (the format Postgres `time` columns round-trip as through Drizzle).
 */
export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_REGEX.test(value);
}

/**
 * Validates and normalizes scheduling input. Shared by
 * POST /api/scheduled-workouts and the workout detail page's Schedule
 * Server Action so the two never drift apart. Rules: workoutId must be a
 * syntactically valid UUID; scheduledDate must be a YYYY-MM-DD string;
 * scheduledTime, if present, must be an HH:MM or HH:MM:SS string, and is
 * normalized to null when absent or empty — a scheduled workout with no
 * specific time is a normal, common state, not a missing value; notes, if
 * present, is trimmed and normalized to null when empty.
 */
export function validateScheduleInput(
  input: RawScheduleInput
): ScheduleValidationResult {
  const workoutId = input.workoutId;
  if (typeof workoutId !== "string" || !isValidUuid(workoutId)) {
    return { success: false, error: "workoutId must be a valid id." };
  }

  const scheduledDate = input.scheduledDate;
  if (!isValidDateString(scheduledDate)) {
    return {
      success: false,
      error: "scheduledDate must be a YYYY-MM-DD date.",
    };
  }

  let scheduledTime: string | null = null;
  if (typeof input.scheduledTime === "string" && input.scheduledTime !== "") {
    if (!isValidTimeString(input.scheduledTime)) {
      return {
        success: false,
        error: "scheduledTime must be an HH:MM time.",
      };
    }
    scheduledTime = input.scheduledTime;
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;

  return {
    success: true,
    data: { workoutId, scheduledDate, scheduledTime, notes },
  };
}

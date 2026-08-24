import { isValidUuid } from "./workouts-validation";

export type ValidatedScheduleInput = {
  workoutId: string;
  scheduledDate: string;
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
  notes?: unknown;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
 * Validates and normalizes scheduling input. Shared by
 * POST /api/scheduled-workouts and the workout detail page's Schedule
 * Server Action so the two never drift apart. Rules: workoutId must be a
 * syntactically valid UUID; scheduledDate must be a YYYY-MM-DD string;
 * notes, if present, is trimmed and normalized to null when empty.
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

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;

  return { success: true, data: { workoutId, scheduledDate, notes } };
}

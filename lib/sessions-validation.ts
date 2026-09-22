/** Shortest and longest session duration accepted, in seconds. */
export const SESSION_DURATION_MIN_SECONDS = 1;
export const SESSION_DURATION_MAX_SECONDS = 24 * 60 * 60;

type SessionDurationResult =
  | { success: true; data: number | null }
  | { success: false; error: string };

/**
 * Validates the optional active duration of a session started from the Start
 * flow. Shared by the finishWorkout Server Action and
 * POST /api/workouts/[id]/sessions so neither can drift. `null` and
 * `undefined` both mean "no duration" and succeed with `null`; anything else
 * must be a whole number of seconds from 1 to 24 hours.
 */
export function validateSessionDuration(value: unknown): SessionDurationResult {
  if (value === null || value === undefined) {
    return { success: true, data: null };
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < SESSION_DURATION_MIN_SECONDS ||
    value > SESSION_DURATION_MAX_SECONDS
  ) {
    return {
      success: false,
      error: `Duration must be a whole number of seconds between ${SESSION_DURATION_MIN_SECONDS} and ${SESSION_DURATION_MAX_SECONDS}.`,
    };
  }

  return { success: true, data: value };
}

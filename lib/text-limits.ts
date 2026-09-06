// Zero imports on purpose — mirrors lib/numeric-limits.ts's own module
// comment: this file is shared by server-only validators
// (workouts-validation.ts, events-validation.ts, personal-records-validation.ts,
// goals-validation.ts, body-metrics-validation.ts, scheduled-workouts-validation.ts)
// AND workout-builder-validation.ts, which must stay free of any runtime
// import of db/schema.ts/drizzle-orm since the builder imports it into the
// client bundle. Kept as its own module rather than folded into
// numeric-limits.ts: a character-length bound is a different kind of check
// (and a different message shape — "at most N characters" vs "at most N
// digits") from a digit-count bound tied to a numeric(x,y) column's
// precision, which is what that file's DigitLimit/checkDigitLimit are
// specifically about.

export type TextLengthResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

// One constant per field, same convention as numeric-limits.ts: a shared
// constant is not reused across unrelated subjects even when the number
// happens to match (see BODY_WEIGHT_DIGIT_LIMIT vs LIFTED_WEIGHT_DIGIT_LIMIT
// there) — so e.g. WORKOUT_TITLE_MAX_LENGTH and GOAL_TITLE_MAX_LENGTH stay
// separate constants below despite sharing the number 100.
export const WORKOUT_TITLE_MAX_LENGTH = 100;
export const GOAL_TITLE_MAX_LENGTH = 100;
export const EVENT_TITLE_MAX_LENGTH = 100;
// workout_sessions.workout_title has no constant of its own — it's a
// snapshot copied verbatim from workouts.title at session-creation time
// (createSessionForWorkout/finishWorkout in lib/sessions.ts), never typed by
// a user directly, so it inherits WORKOUT_TITLE_MAX_LENGTH by virtue of what
// it copies. Do not add a second constant for it.

export const BLOCK_TITLE_MAX_LENGTH = 60;

export const ITEM_CUSTOM_NAME_MAX_LENGTH = 80;
export const RECORD_CUSTOM_NAME_MAX_LENGTH = 80;
export const GOAL_TARGET_CUSTOM_NAME_MAX_LENGTH = 80;

export const EVENT_LOCATION_MAX_LENGTH = 120;

export const WORKOUT_DESCRIPTION_MAX_LENGTH = 500;
export const ITEM_NOTES_MAX_LENGTH = 500;
export const SCHEDULE_NOTES_MAX_LENGTH = 500;
export const BODY_METRIC_NOTES_MAX_LENGTH = 500;
export const RECORD_NOTES_MAX_LENGTH = 500;
export const EVENT_NOTES_MAX_LENGTH = 500;

// Not persisted — the /workouts/library search box (WorkoutFilters.tsx),
// parsed by parseWorkoutListSearchParams (lib/workouts-filters.ts), which
// has no validator of its own to hold this check inline; the cap is applied
// there directly instead. Matches WORKOUT_TITLE_MAX_LENGTH since it searches
// that exact column, kept as its own constant regardless (same
// drift-independence reasoning as every other constant in this file).
export const WORKOUT_SEARCH_MAX_LENGTH = 100;

/**
 * Rejects `trimmed` if it is longer than `maxLength`. Takes the
 * already-trimmed value, never a raw one — every caller trims (and
 * normalizes empty-to-null) first, then checks length, so trailing
 * whitespace can never push an otherwise-valid value over the limit, and
 * the length actually checked matches what gets written to the database.
 * `label` names the field in the message, matching checkDigitLimit's own
 * convention in lib/numeric-limits.ts.
 */
export function checkTextLength(
  trimmed: string,
  maxLength: number,
  label: string
): TextLengthResult {
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${label} can be at most ${maxLength} characters.`,
    };
  }
  return { ok: true, value: trimmed };
}

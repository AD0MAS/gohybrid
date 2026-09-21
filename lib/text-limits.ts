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

// Three tiers, one constant each; every user-entered text field maps to one of
// them and none has a number of its own. Unlike numeric-limits.ts (one
// constant per column, because a digit bound follows the column's precision),
// a character bound is a product decision about how much a kind of text may
// say, so fields of a kind share it — change a tier here and every field in it
// follows, in the validators and in the inputs' maxLength alike.
//
// NAME — a title or a name: workouts.title, workout_blocks.title,
// workout_items.custom_name, personal_records.custom_name, goals.title,
// goals.target_custom_name, events.title. workout_sessions.workout_title is a
// snapshot copied from workouts.title (createSessionForWorkout/finishWorkout
// in lib/sessions.ts), never typed by a user, so it has no check of its own.
export const NAME_MAX_LENGTH = 60;
// SHORT — other single-line free text: events.location and the /workouts
// search box (WorkoutFilters.tsx, applied by parseWorkoutListSearchParams in
// lib/workouts-filters.ts, which has no validator of its own; not persisted).
export const SHORT_TEXT_MAX_LENGTH = 60;
// LONG — multi-line free text: workouts.description, workout_items.notes and
// the notes on scheduled_workouts, body_metrics, personal_records, events.
export const LONG_TEXT_MAX_LENGTH = 300;

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

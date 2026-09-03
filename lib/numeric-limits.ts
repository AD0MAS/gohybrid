// Zero imports on purpose — this file is shared by lib/body-metrics-validation.ts,
// lib/personal-records-validation.ts, lib/goals-validation.ts (server-only) AND
// lib/workout-builder-validation.ts, which must stay free of any runtime
// import of db/schema.ts/drizzle-orm since the builder imports it into the
// client bundle. A pure-math file with no dependencies is safe everywhere.

export type DigitLimit = { maxIntegerDigits: number; maxDecimals: number };

export type DigitLimitResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

// Realistic, tighter-than-the-column bounds for each numeric subject a form
// collects — see checkDigitLimit's doc comment for how they're enforced, and
// each validator's own comment for why its subject maps to the constant it
// uses. Centralized here so the same number can't drift between, e.g., a
// personal record's own weight field and a goal that targets one.
//
// workout_items.weight_kg and target_value are numeric(6,2) (GOHYBRID_PLAN.md
// §6) — narrower than personal_records.value/goals.target_value's
// numeric(9,2) (§6B). volume_value is numeric(9,2) too, widened from
// numeric(6,2) so a distance volume item isn't capped at 9999.99 m (9.99
// km — unusable for a run); see db/migrations for the ALTER. BODY_WEIGHT/
// LIFTED_WEIGHT/REPS fit every column width unchanged. ITEM_CALORIES_DIGIT_
// LIMIT/ITEM_DISTANCE_DIGIT_LIMIT (volume_value) now share their shape with
// CALORIES_DIGIT_LIMIT/DISTANCE_DIGIT_LIMIT, but ITEM_TARGET_RATE_DIGIT_
// LIMIT/ITEM_PACE_DIGIT_LIMIT (target_value, still numeric(6,2)) stay
// narrower than their PR/goal counterparts so a value that column can't
// hold is never validated as fine — see workout-builder-validation.ts's
// comment at their use.
export const BODY_WEIGHT_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 4, maxDecimals: 1 };
export const BODY_FAT_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 2, maxDecimals: 1 };
export const RESTING_HR_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 3, maxDecimals: 0 };
export const LIFTED_WEIGHT_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 4, maxDecimals: 1 };
export const REPS_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 4, maxDecimals: 0 };
export const CALORIES_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 5, maxDecimals: 0 };
// maxDecimals 2, not 0: distance is a converted unit (a typed ft/mi value
// legitimately becomes a fractional number of metres — see
// convertDistanceInputToMetres in lib/units.ts), and the column has room
// for it (numeric(9,2)). 7 integer digits + 2 decimals is exactly that
// column's capacity, so this stays a true backstop.
export const DISTANCE_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 7, maxDecimals: 2 };
// workouts.estimated_duration_minutes is a plain `integer` column (no
// numeric(x,y) bound), so this limit is plausibility-only: a workout longer
// than 999 minutes isn't real. Shares its shape with RESTING_HR_DIGIT_LIMIT
// but is kept as its own constant, same reasoning as BODY_WEIGHT vs
// LIFTED_WEIGHT above — an unrelated field's bound must not drift this one.
export const DURATION_MINUTES_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 3, maxDecimals: 0 };
// goals.target_value is numeric(9,2) — plenty wide enough on its own, so
// this limit is plausibility-only, same reasoning as
// DURATION_MINUTES_DIGIT_LIMIT above. Kept as its own constant rather than
// reusing REPS_DIGIT_LIMIT despite the identical shape: a session_count/
// streak goal target is a different subject from an item's rep count, and
// the two must be free to diverge later without dragging each other along
// (see BODY_WEIGHT vs LIFTED_WEIGHT above for the same principle). 4 digits
// (max 9999) comfortably covers any realistic session-count or streak
// target across every goal period, including "all_time".
export const GOAL_COUNT_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 4, maxDecimals: 0 };
// workout_items.volume_value is numeric(9,2) (widened from numeric(6,2) —
// see the module comment above), the same capacity as personal_records'/
// goals' own calorie counts, so this now shares CALORIES_DIGIT_LIMIT's
// shape exactly. Kept as its own constant rather than reused: an item's
// calorie count and a PR/goal's are still different subjects, and the two
// must be free to diverge later without dragging each other along (see
// BODY_WEIGHT vs LIFTED_WEIGHT above).
export const ITEM_CALORIES_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 5, maxDecimals: 0 };
// Same reasoning as ITEM_CALORIES_DIGIT_LIMIT immediately above — now
// shares DISTANCE_DIGIT_LIMIT's shape (volume_value's widened numeric(9,2)
// capacity), kept as its own constant for the same drift-independence
// reason. maxDecimals stays 2: distance is a converted unit (see
// DISTANCE_DIGIT_LIMIT's own comment above).
export const ITEM_DISTANCE_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 7, maxDecimals: 2 };
// workout_items.target_value is its own column, still numeric(6,2) (only
// volume_value was widened — see the module comment above), so it keeps a
// 4-integer-digit ceiling regardless of which target_type it holds. Cal/h
// and watts are both plain rate numbers with no legitimate fractional
// value — kept as its own constant rather than reused since target_value
// and volume_value are unrelated fields whose bounds must not drift
// together (see BODY_WEIGHT vs LIFTED_WEIGHT above).
export const ITEM_TARGET_RATE_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 4, maxDecimals: 0 };
// Pace, stored in seconds, in the same still-numeric(6,2) target_value
// column as ITEM_TARGET_RATE_DIGIT_LIMIT above — no longer the same shape
// as ITEM_DISTANCE_DIGIT_LIMIT now that volume_value and target_value have
// diverged, just the same 4-integer-digit ceiling that column's capacity
// allows. maxDecimals is 2, not 0, because a pace typed in /mi converts to
// a non-integer number of seconds-per-km via secondsPerMileToSecondsPerKm
// (lib/units.ts), and the column has room for it.
export const ITEM_PACE_DIGIT_LIMIT: DigitLimit = { maxIntegerDigits: 4, maxDecimals: 2 };

/**
 * Rounds `raw` to `limit.maxDecimals` and rejects it if the result needs
 * more than `limit.maxIntegerDigits` digits before the decimal point.
 * `raw` must already be a finite, positive number — every caller checks
 * that itself first, since what counts as "required"/"must be positive"
 * has its own field-specific message. `label` is the message's field name
 * with any unit the caller wants named already folded in (e.g.
 * "Weight (lb)") — this function stays unit-agnostic on purpose, since the
 * unit a value should be reported in depends on what the user actually
 * typed (kg vs lb, or none at all for a count), which only the caller
 * knows.
 *
 * maxDecimals === 0 means "a whole number" and REJECTS a non-integer input
 * rather than silently rounding it — Reps, Calories, Resting HR: there's no
 * legitimate source of a fractional value for any of these, so a decimal is
 * a typo worth surfacing, not silently discarding. Distance used to need an
 * escape hatch here (an imperial mile/foot input converts to a non-integer
 * number of metres through METRES_PER_MILE/METRES_PER_FOOT in lib/units.ts),
 * but now carries maxDecimals: 2 instead of 0 (DISTANCE_DIGIT_LIMIT/
 * ITEM_DISTANCE_DIGIT_LIMIT above) — the columns had room for it
 * (numeric(9,2)/numeric(6,2)) and rounding to whole metres was silently
 * corrupting a converted value (10 ft stored as 3 m, read back as 9.8 ft).
 * A fractional distance now just rounds to 2 decimals like any other
 * maxDecimals > 0 field, so no per-caller opt-out is needed any more.
 */
export function checkDigitLimit(
  raw: number,
  limit: DigitLimit,
  label: string
): DigitLimitResult {
  const { maxIntegerDigits, maxDecimals } = limit;

  if (maxDecimals === 0 && !Number.isInteger(raw)) {
    return { ok: false, error: `${label} must be a whole number.` };
  }

  const factor = 10 ** maxDecimals;
  const rounded = Math.round(raw * factor) / factor;
  const maxValue = 10 ** maxIntegerDigits - 1 / factor;
  if (rounded > maxValue) {
    return {
      ok: false,
      error: `${label} can be at most ${maxIntegerDigits} digit${
        maxIntegerDigits === 1 ? "" : "s"
      }.`,
    };
  }

  return { ok: true, value: rounded };
}

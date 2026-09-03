import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";
import type { DigitLimit } from "@/lib/numeric-limits";

type LiveNumberOptions = {
  min?: number;
  max?: number;
  /** Forces Math.trunc even with no digitLimit (or one whose maxDecimals
   * isn't 0) — for a field like RPE that has no matching DigitLimit
   * constant of its own but must still reject a typed decimal. Implied
   * automatically whenever digitLimit.maxDecimals is 0, so most callers
   * never pass this themselves. */
  integer?: boolean;
  digitLimit?: DigitLimit;
};

/**
 * Parses a number input's raw typed value into a sanitized number (or
 * null for a blank, optional field), on every keystroke — the plain
 * `<input type="number">` fields across the builder (ItemEditor,
 * BlockEditor, WorkoutBuilder) can't rely on the `min`/`max`/`step`
 * attributes to do this: the builder's <form> has noValidate (see
 * WorkoutBuilder's own doc comment), and even without that, a typed "-",
 * "e"/scientific notation, or a value with far more digits than the
 * column allows all pass straight through those attributes while typing.
 *
 * This mirrors the fix ItemEditor's RPE field already used (parse, fall
 * back to null on a non-finite result, clamp) — the same "sanitize the
 * derived value, let the controlled re-render correct what's shown" idiom
 * DurationInput/DistanceInput's own boxes already use, and it also catches
 * paste/autofill. `digitLimit` adds the same digit-count cap
 * workout-builder-validation.ts enforces server-side, so a value this
 * lets through can't be one the validator would reject on Save; passing
 * one whose `maxDecimals` is 0 truncates decimals the same way an
 * explicit `integer: true` does.
 *
 * This is NOT sufficient on its own, though — see numberInputGuardProps
 * below for why every one of these fields also needs the onKeyDown/onPaste
 * guard, and use both together.
 */
export function sanitizeLiveNumber(
  raw: string,
  { min, max, integer, digitLimit }: LiveNumberOptions
): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  let value = parsed;
  if (integer || digitLimit?.maxDecimals === 0) {
    value = Math.trunc(value);
  } else if (digitLimit) {
    const factor = 10 ** digitLimit.maxDecimals;
    value = Math.round(value * factor) / factor;
  }

  if (min !== undefined) value = Math.max(value, min);

  if (digitLimit) {
    const factor = 10 ** digitLimit.maxDecimals;
    const maxValue = 10 ** digitLimit.maxIntegerDigits - 1 / factor;
    value = Math.min(value, maxValue);
  }
  if (max !== undefined) value = Math.min(value, max);

  return value;
}

/**
 * The same clamp sanitizeLiveNumber's `digitLimit`/`max` branches compute
 * internally, exposed on its own: the single largest value the field will
 * ever accept, min(the digit-limit-derived ceiling, an explicit `max`).
 * Shared by correctedLiveNumberText below and DistanceInput's own text
 * correction, both of which need to know "is the raw text already past the
 * field's own ceiling" independently of whatever sanitizeLiveNumber's
 * *rounded* return value happens to be this keystroke.
 */
export function ceilingFor({ max, digitLimit }: LiveNumberOptions): number | undefined {
  let ceiling: number | undefined;
  if (digitLimit) {
    const factor = 10 ** digitLimit.maxDecimals;
    ceiling = 10 ** digitLimit.maxIntegerDigits - 1 / factor;
  }
  if (max !== undefined) {
    ceiling = ceiling === undefined ? max : Math.min(ceiling, max);
  }
  return ceiling;
}

/**
 * Shared by sanitizeNumberInputChange below and DistanceInput's own text
 * correction: decides whether `raw` needs rewriting back to `sanitized`'s
 * canonical string, or is a legitimate in-progress prefix that should be
 * left alone. "Redundant" is deliberately narrow, to avoid stripping text
 * the user is legitimately still typing toward a different value:
 *  - a leading zero immediately followed by another digit ("00", "05") —
 *    leading zeros never carry meaning in this app, so this is always safe
 *    to collapse regardless of what follows.
 *  - decimal digits beyond `maxDecimals` ("1.00" once maxDecimals is 1) —
 *    once that many decimals are typed, further digits round away to the
 *    same value, so continuing to accept them has no effect on what gets
 *    saved.
 *  - raw's own numeric value already exceeds `ceiling` (typing "99999" into
 *    a 4-digit field, or "910" into RPE's 1-10 range) — this is checked
 *    against raw's OWN parse, not against whether `sanitized` differs from
 *    whatever the field showed last render, because those can disagree: a
 *    field already pinned at its ceiling that gets MORE digits prepended
 *    (cursor at position 0, not appending at the end) still clamps to the
 *    exact same ceiling value as before, so a "did the value change"
 *    comparison would miss it — nothing besides the field's own ceiling
 *    tells you the text has grown past what's reachable.
 * A bare trailing "." or decimals still within budget are left alone even
 * though they parse to the same value as before — that in-progress case is
 * exactly what the plain sanitizeLiveNumber + controlled-value idiom is
 * built to tolerate (see sanitizeLiveNumber's own doc comment), and forcing
 * the canonical string back on every keystroke would make it impossible to
 * ever type a decimal point. Returns the corrected string to write back, or
 * null when `raw` needs no change.
 */
export function correctedLiveNumberText(
  raw: string,
  sanitized: number | null,
  { maxDecimals, ceiling }: { maxDecimals: number; ceiling?: number }
): string | null {
  if (raw === "") return null;

  const hasRedundantLeadingZero = /^0\d/.test(raw);
  const dotIndex = raw.indexOf(".");
  const hasRedundantDecimal =
    dotIndex !== -1 && raw.length - dotIndex - 1 > maxDecimals;
  const rawValue = Number(raw);
  const hasExceededCeiling =
    ceiling !== undefined && Number.isFinite(rawValue) && rawValue > ceiling;

  if (!hasRedundantLeadingZero && !hasRedundantDecimal && !hasExceededCeiling) {
    return null;
  }
  return sanitized === null ? "" : String(sanitized);
}

/**
 * The onChange counterpart to numberInputGuardProps' onKeyDown/onPaste pair:
 * runs sanitizeLiveNumber as usual, then corrects the DOM text itself for
 * the classes of drift neither the guard nor a plain controlled `value`
 * catches — see correctedLiveNumberText's doc comment for exactly which.
 * The core problem in all of them: React's own reconciliation for
 * `type="number"` (react-dom's updateInput) compares the live DOM text
 * against the value prop with `!=`: `"00" != 0` is false (they coerce
 * equal), so React skips rewriting the DOM whenever the two are only
 * loosely equal, or whenever the sanitized value is byte-for-byte unchanged
 * from the previous render (e.g. already clamped to the same ceiling).
 * Every field driven by sanitizeLiveNumber's returned number hits this;
 * DurationInput/DistanceInput's own boxes don't, because their controlled
 * value is always the raw typed *string*, and a string `value` takes
 * updateInput's other branch (strict string comparison, no numeric
 * coercion) — see their own files for why they need a different fix
 * (DistanceInput reuses correctedLiveNumberText directly, since nothing
 * ever auto-corrects a string-valued controlled input the way React does
 * here for a number-valued one).
 */
export function sanitizeNumberInputChange(
  e: ChangeEvent<HTMLInputElement>,
  options: LiveNumberOptions & { allowDecimal?: boolean }
): number | null {
  const raw = e.target.value;
  const sanitized = sanitizeLiveNumber(raw, options);

  const maxDecimals =
    options.integer || options.digitLimit?.maxDecimals === 0
      ? 0
      : (options.digitLimit?.maxDecimals ?? (options.allowDecimal ? Infinity : 0));

  const corrected = correctedLiveNumberText(raw, sanitized, {
    maxDecimals,
    ceiling: ceilingFor(options),
  });
  if (corrected !== null) e.target.value = corrected;

  return sanitized;
}

type NumberInputGuardOptions = {
  /** Whether "." may ever appear. Every whole-number field (RPE, Sets,
   * Rounds, Cal/h, Watts, Estimated duration, the reps/calories branch of
   * Volume value, DurationInput's boxes, and most of the /profile number
   * fields) leaves this false; Weight in kg, DistanceInput's own box, and
   * a handful of /profile fields (a weight value, a non-resting_hr body
   * metric) are the ones that pass true. Default false. */
  allowDecimal?: boolean;
};

const BLOCKED_KEYS = new Set(["-", "+", "e", "E"]);

/**
 * Returns the `onKeyDown`/`onPaste` pair every `<input type="number">` in
 * this app needs, to spread directly onto the element (`{...numberInputGuardProps(...)}`) alongside
 * sanitizeLiveNumber's onChange.
 *
 * Why onChange sanitization alone isn't enough: per the WHATWG "value
 * sanitization algorithm" for `type="number"`, the moment a number input's
 * typed text stops being a valid floating-point number — a lone "-", a
 * lone "e"/"E", a second "-", "2--2" — the browser reports
 * `e.target.value` as an empty string while leaving the invalid text
 * visibly typed into the field. sanitizeLiveNumber then (correctly) turns
 * that empty string into `null`. The problem is specifically when the
 * field was already empty/null before the keystroke: state goes from
 * `null` to `null`, React sees no change in the controlled `value` prop
 * between renders, and never touches the DOM — so the garbage text the
 * user just typed is left sitting there uncleared, while the application
 * state (correctly) has nothing. Blocking the keystroke before it ever
 * lands is the only way to keep the visible text and the sanitized state
 * from disagreeing in the first place.
 *
 * "-"/"+"/"e"/"E" are always blocked: no numeric field anywhere in this
 * app (workout builder, /profile, DistanceInput, DurationInput) ever has a
 * legitimate negative value or scientific notation. "." is blocked
 * whenever `allowDecimal` is false, and — even when true — the moment the
 * field already has one, since a second "." is exactly the same class of
 * "browser reports empty, text stays visible" case (e.g. "1.2." typed
 * into a Weight box). Every other key (digits, Backspace/Delete, the
 * arrow keys, Tab, Ctrl/Cmd+A/C/V/X/Z) passes through untouched — this
 * only ever calls `preventDefault()` for the exact characters above, and
 * never when a Ctrl/Cmd/Alt modifier is held, so copy/paste/select-all/
 * undo shortcuts stay intact.
 *
 * onPaste validates the clipboard text alone (not merged with whatever's
 * already in the field) against the same digits-and-at-most-one-dot shape
 * onKeyDown enforces one character at a time, and rejects the entire
 * paste — rather than stripping and splicing the remainder in at the
 * cursor — if it doesn't match. That's deliberately the simpler of the
 * two options for a bad paste: splicing correctly would mean re-deriving
 * the merged value and re-validating it as a whole number, which is
 * exactly what sanitizeLiveNumber's onChange already does the moment a
 * *valid* paste lands; reconstructing that here for an *invalid* one would
 * duplicate it for a case a user can just paste again correctly.
 *
 * No onBlur here (there used to be one, for the /profile forms' number
 * inputs back when they were plain uncontrolled `<input defaultValue>`
 * elements with no per-keystroke correction at all). Every numeric field in
 * the app, /profile included, is now a controlled input wired through
 * sanitizeNumberInputChange (NumberField, app/(app)/_components/
 * NumberField.tsx, is the /profile forms' version of that wiring), so
 * correction already happens on every keystroke — an onBlur pass over
 * already-canonical text has nothing left to do.
 */
export function numberInputGuardProps({
  allowDecimal = false,
}: NumberInputGuardOptions = {}): {
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
} {
  return {
    onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (BLOCKED_KEYS.has(e.key)) {
        e.preventDefault();
        return;
      }
      if (
        e.key === "." &&
        (!allowDecimal || e.currentTarget.value.includes("."))
      ) {
        e.preventDefault();
      }
    },
    onPaste(e) {
      const pasted = e.clipboardData.getData("text");
      const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d+$/;
      if (!pattern.test(pasted)) {
        e.preventDefault();
      }
    },
  };
}

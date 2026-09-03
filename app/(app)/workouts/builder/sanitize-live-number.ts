import type { ClipboardEvent, KeyboardEvent } from "react";
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

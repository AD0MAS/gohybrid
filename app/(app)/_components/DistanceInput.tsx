"use client";

import { useState } from "react";
import type { unitSystemEnum } from "@/db/schema";
import type { DigitLimit } from "@/lib/numeric-limits";
import {
  convertDistanceInputToMetres,
  metresToFeet,
  metresToKm,
  metresToMiles,
  type DistanceInputUnit,
} from "@/lib/units";
import {
  ceilingFor,
  correctedLiveNumberText,
  numberInputGuardProps,
  sanitizeLiveNumber,
} from "./sanitize-live-number";

type UnitSystem = (typeof unitSystemEnum.enumValues)[number];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Read-side counterpart to convertDistanceInputToMetres, local to this
 * component: converts a stored metres value into whatever unit is
 * currently selected, for display and for re-displaying after a unit
 * switch. Never exported — formatDistanceMetres (lib/units.ts) is the
 * shared read-side converter for anything that isn't this input. */
function metresToUnit(metres: number, unit: DistanceInputUnit): number {
  switch (unit) {
    case "m":
      return metres;
    case "km":
      return metresToKm(metres);
    case "ft":
      return metresToFeet(metres);
    case "mi":
      return metresToMiles(metres);
  }
}

function unitOptions(
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): readonly DistanceInputUnit[] {
  if (isHyroxStation) return ["m"];
  return unitSystem === "imperial" ? ["ft", "mi"] : ["m", "km"];
}

function stepForUnit(unit: DistanceInputUnit): number {
  return unit === "km" || unit === "mi" ? 0.5 : 10;
}

/**
 * Converts `metresLimit` — the digit limit of whichever column this
 * instance's value ultimately lands in (workout_items.volume_value via
 * ITEM_DISTANCE_DIGIT_LIMIT, or personal_records.value/goals.target_value
 * via DISTANCE_DIGIT_LIMIT — both numeric(9,2), so the two currently share
 * a shape) — into an equivalent cap for the currently selected display
 * unit, for live-typing correction only. Deliberately loose rather than
 * exact: digit-count limits are inherently a "how many digits" bound, not a
 * tight value bound, so a unit whose conversion factor isn't a power of ten
 * (ft, mi) ends up with a per-unit ceiling somewhat above the true metres
 * bound (e.g. a 7-digit metres cap of 9999999.99 m becomes an 8-digit ft
 * cap, since 9999999.99 m in feet already needs 8 integer digits). That's
 * fine — this cap only exists to stop a typed value from growing without
 * limit while the user is mid-keystroke; the actual bound is enforced
 * separately, in metres, by compose() below, which is what every caller's
 * onChange/dispatched value actually goes through.
 */
function digitLimitForUnit(
  unit: DistanceInputUnit,
  metresLimit: DigitLimit
): DigitLimit {
  const maxMetres =
    10 ** metresLimit.maxIntegerDigits - 10 ** -metresLimit.maxDecimals;
  const maxIntegerDigits = Math.max(
    1,
    String(Math.floor(metresToUnit(maxMetres, unit))).length
  );
  return { maxIntegerDigits, maxDecimals: metresLimit.maxDecimals };
}

/**
 * DistanceInput's own text-correction, called from updateText on every
 * keystroke — the equivalent of what DurationInput's clampBox does for its
 * own boxes, adapted for a field that (unlike DurationInput's whole-number
 * 0-59/0-99 boxes) must tolerate decimals and can't just collapse the raw
 * text to a canonical number on every change. Delegates entirely to
 * correctedLiveNumberText (the same leading-zero/decimal-budget/ceiling
 * rules sanitizeNumberInputChange applies to the builder's plain number
 * fields), passing `unitLimit`'s own ceiling via ceilingFor — that ceiling
 * check is what catches an overlong *integer* part here ("333333333333",
 * no leading zero, no decimal), a class of drift the plain number fields
 * never had to reach for it themselves, since their controlled `value` is a
 * number and React's own reconciliation already rewrites the DOM once the
 * parsed value genuinely differs (see sanitizeNumberInputChange's doc
 * comment). DistanceInput's controlled value is the raw string itself (see
 * the module doc comment for why), so nothing else will ever catch it.
 */
function correctedDistanceText(
  raw: string,
  unitLimit: DigitLimit
): string | null {
  const sanitized = sanitizeLiveNumber(raw, { min: 0, digitLimit: unitLimit });
  return correctedLiveNumberText(raw, sanitized, {
    maxDecimals: unitLimit.maxDecimals,
    ceiling: ceilingFor({ digitLimit: unitLimit }),
  });
}

/** The unit a fresh distance input opens with when nothing pins it
 * otherwise: HYROX always metres; empty (nothing stored yet) is the
 * "creating" case from the small unit for the unit system; a stored value
 * picks small vs. large by the same 1000 m threshold formatDistanceMetres
 * uses for display — the only place that threshold survives, and only as
 * an opening guess the user can override via the <select>. */
function defaultUnitFor(
  metres: number | null,
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): DistanceInputUnit {
  if (isHyroxStation) return "m";
  const small: DistanceInputUnit = unitSystem === "imperial" ? "ft" : "m";
  const large: DistanceInputUnit = unitSystem === "imperial" ? "mi" : "km";
  if (metres === null) return small;
  return metres < 1000 ? small : large;
}

type Box = { text: string; unit: DistanceInputUnit };

function decompose(
  metres: number | null,
  unitSystem: UnitSystem,
  isHyroxStation: boolean,
  overrideUnit: DistanceInputUnit | undefined
): Box {
  const unit = isHyroxStation
    ? "m"
    : (overrideUnit ?? defaultUnitFor(metres, unitSystem, isHyroxStation));
  const text = metres === null ? "" : String(round2(metresToUnit(metres, unit)));
  return { text, unit };
}

/** Inverse of decompose's `text`/`unit` pair — parses the currently typed
 * number in the currently selected unit into metres, or null when blank
 * or not a finite number (mid-edit states like "-" or "."). Goes through
 * sanitizeLiveNumber (min: 0, no digitLimit — decimals stay exactly as
 * typed) rather than a bare `Number(text)`: unlike every other numeric
 * field in the builder, this one never got a live clamp, so a typed
 * negative distance (e.g. "-500") converted straight through to metres
 * and reached item.volumeValue as a negative number, same DB column any
 * other volume value shares.
 *
 * The result is then clamped against `metresLimit` — in metres, the unit
 * the value is actually stored/validated in — regardless of what unit was
 * typed. This is the authoritative bound: digitLimitForUnit's per-unit cap
 * above is only a live-typing throttle and, for ft/mi, is looser than the
 * true metres bound (see its own doc comment), so a value that passes the
 * per-unit text check can still need clamping here before it's ever handed
 * to onChange. */
function compose(
  text: string,
  unit: DistanceInputUnit,
  metresLimit: DigitLimit
): number | null {
  const value = sanitizeLiveNumber(text, { min: 0 });
  if (value === null) return null;
  const metres = convertDistanceInputToMetres(value, unit);
  return sanitizeLiveNumber(String(metres), { min: 0, digitLimit: metresLimit });
}

type DistanceInputBaseProps = {
  unitSystem: UnitSystem;
  /** Official HYROX distances are metric worldwide — locks the unit to
   * "m" and disables the <select> regardless of
   * unitSystem. */
  isHyroxStation: boolean;
  /** The digit limit of whichever column this instance's value ultimately
   * lands in, in metres — ITEM_DISTANCE_DIGIT_LIMIT for ItemEditor's
   * volume_value (numeric(6,2)), DISTANCE_DIGIT_LIMIT for
   * PersonalRecordFields/GoalFields' value/target_value (numeric(9,2)).
   * Passed explicitly rather than assumed, same as every other field's own
   * digitLimit — DistanceInput has no column of its own to know about.
   * Drives both digitLimitForUnit's live-typing cap and compose()'s
   * authoritative metres-space clamp. */
  digitLimit: DigitLimit;
  className?: string;
};

type UncontrolledDistanceInputProps = DistanceInputBaseProps & {
  /** Uncontrolled mode: contributes the typed number under this name, and
   * the selected unit under `${name}Unit`, via two hidden inputs — see the
   * module doc comment below for why distance needs two fields where
   * DurationInput's single seconds total needs only one. */
  name: string;
  defaultValueMetres?: number | null;
  /** Pins the starting unit exactly, bypassing defaultUnitFor's
   * metres-based heuristic. Only ever passed for error-recovery: the
   * heuristic re-guesses a unit from the converted metres value (e.g. a
   * typed "3000" in "m" round-trips to 3000 m, which the heuristic would
   * then reopen as "km"), so restoring exactly what the user had selected
   * needs the unit itself echoed back, not re-derived. */
  defaultUnit?: DistanceInputUnit;
};

type ControlledDistanceInputProps = DistanceInputBaseProps & {
  /** Controlled mode: for the workout builder's reducer, where every
   * keystroke and every unit switch must dispatch. Mutually exclusive with
   * the uncontrolled props. */
  valueMetres: number | null;
  onChange: (metres: number | null) => void;
};

export type DistanceInputProps =
  | UncontrolledDistanceInputProps
  | ControlledDistanceInputProps;

const inputClassName =
  "h-11 flex-1 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
const selectClassName =
  "h-11 rounded-md border border-hairline bg-surface-1 px-2 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus disabled:text-ink-subtle";

/**
 * A number input paired with an explicit unit <select> — replaces the old
 * inferred-input-unit approach (resolveDistanceInputUnit/toDistanceInputValue
 * in lib/units.ts, now removed) that disagreed with formatDistanceMetres'
 * per-value display unit and once caused a silent data-corruption bug. When
 * the user picks the unit themselves, nothing has to be inferred. Value in
 * and out is always METRES, or null when the number box is empty; unit
 * options come from `unitSystem` (m/km or ft/mi), collapsing to a
 * disabled-"m" <select> when `isHyroxStation` is true (HYROX distances
 * are always metric).
 *
 * Switching the unit CONVERTS the currently displayed number rather than
 * reinterpreting it: 5000 typed under "m", switched to "km", must show 5 —
 * not 5000 relabelled. `compose` turns the old (text, unit) pair into
 * metres first, then `metresToUnit` re-expresses that same physical
 * quantity in the new unit, rounded to 2 decimal places (round2, local to
 * this file — same precision toDistanceInputValue used before removal).
 * Two decimals rather than DurationInput's whole-number boxes because a
 * distance typed in km/mi is routinely fractional (e.g. "5.2 km"); metres
 * and feet get the same treatment for one consistent rule rather than a
 * per-unit branch. The step also follows the unit — 10 for m/ft (whole
 * units are the natural increment), 0.5 for km/mi (a whole km/mi step
 * would jump too coarsely).
 *
 * Same dual API as DurationInput, and the same reason for it: controlled
 * (`valueMetres` + `onChange`) for the builder's reducer-driven state,
 * uncontrolled (`name` + `defaultValueMetres`) for the profile forms
 * (PersonalRecordFields, GoalFields), which read FormData on submit.
 * DurationInput's single hidden input works because its unit (seconds) is
 * fixed; distance's unit is a user choice, so the uncontrolled case mirrors
 * TWO hidden inputs — `name` carrying the raw typed number in whatever unit
 * is currently selected, and `${name}Unit` carrying that unit — rather than
 * pre-converting to metres client-side. The Server Action
 * (addPersonalRecord/updatePersonalRecord/addGoal/updateGoal) reads both off
 * FormData and calls convertDistanceInputToMetres(value, unit) itself,
 * before validation — same principle as every other unit conversion in this
 * app ("unit conversion happens only at the display boundary, and in
 * reverse on write ... in the Server Action, because the
 * client is a convenience and the server is the gate"). The controlled case
 * has no such round trip: `onChange` is called with `compose`'s result (a
 * metres number) directly, computed with the very same convertDistanceInputToMetres
 * the Server Actions call — one function, two call sites.
 *
 * Each box keeps its own local `{ text, unit }` state rather than being
 * derived fresh from `valueMetres`/`defaultValueMetres` on every render,
 * for the same reason as DurationInput's boxes: a controlled number input
 * re-rendered with a normalized value fights the browser's cursor/leading-
 * zero handling on the next keystroke. `defaultValueMetres`/`defaultUnit`
 * (or `valueMetres` for the initial render) are read only once, to seed
 * that local state — which means `isHyroxStation` flipping on an already-
 * mounted instance (the user switches which exercise a distance PR/goal/
 * item targets, from a HYROX station to a regular exercise or back) does
 * NOT by itself update `unit` back out of/into the forced "m": `unitOptions`
 * recomputes every render, but the currently selected `unit` only lives in
 * local state. Every call site (PersonalRecordFields, GoalFields, ItemEditor)
 * therefore keys its DistanceInput on `isHyroxStation`, forcing a fresh
 * mount — and a fresh, correct default-unit guess — exactly when that
 * happens, same pattern as BlockEditor's `key={block.blockType}` on
 * DurationInput.
 *
 * No `required` prop, matching DurationInput's reasoning: a hidden input is
 * barred from native constraint validation by the HTML spec regardless of
 * the attribute, and every caller already falls back to the shared
 * server-side validators (validatePersonalRecordInput/validateGoalInput)
 * for this.
 */
export default function DistanceInput(props: DistanceInputProps) {
  const { unitSystem, isHyroxStation, digitLimit, className } = props;
  const isControlled = "onChange" in props;

  const [box, setBox] = useState<Box>(() =>
    decompose(
      isControlled ? props.valueMetres : (props.defaultValueMetres ?? null),
      unitSystem,
      isHyroxStation,
      isControlled ? undefined : props.defaultUnit
    )
  );

  function updateText(text: string) {
    const unitLimit = digitLimitForUnit(box.unit, digitLimit);
    const corrected = correctedDistanceText(text, unitLimit) ?? text;
    const next = { ...box, text: corrected };
    setBox(next);
    if (isControlled) {
      props.onChange(compose(corrected, box.unit, digitLimit));
    }
  }

  function updateUnit(unit: DistanceInputUnit) {
    const metres = compose(box.text, box.unit, digitLimit);
    const next: Box = {
      text: metres === null ? box.text : String(round2(metresToUnit(metres, unit))),
      unit,
    };
    setBox(next);
    if (isControlled) {
      props.onChange(metres);
    }
  }

  const options = unitOptions(unitSystem, isHyroxStation);

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={stepForUnit(box.unit)}
        value={box.text}
        onChange={(e) => updateText(e.target.value)}
        {...numberInputGuardProps({ allowDecimal: true })}
        aria-label="Distance"
        className={inputClassName}
      />
      <select
        value={box.unit}
        disabled={isHyroxStation}
        onChange={(e) => updateUnit(e.target.value as DistanceInputUnit)}
        aria-label="Distance unit"
        className={selectClassName}
      >
        {options.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
      {!isControlled && (
        <>
          <input type="hidden" name={props.name} value={box.text} />
          <input type="hidden" name={`${props.name}Unit`} value={box.unit} />
        </>
      )}
    </div>
  );
}

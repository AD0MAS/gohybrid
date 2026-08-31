"use client";

import { useState } from "react";

const MAX_HOURS = 99;
const MAX_MINUTES_OR_SECONDS = 59;

type Boxes = { h: string; m: string; s: string };

/** Clamps a typed digit string into [0, max], dropping anything that isn't
 * a finite number. Blank stays blank — that's the "unset" state, not 0. */
function clampBox(raw: string, max: number): string {
  if (raw === "") return "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(Math.max(Math.trunc(parsed), 0), max));
}

/** What an empty box shows: "00" everywhere, so a box that counts as zero
 * internally (see composeSeconds) looks like zero instead of looking empty. */
function displayBox(raw: string): string {
  return raw === "" ? "00" : raw;
}

function decomposeSeconds(
  totalSeconds: number | null,
  maxUnit: "minutes" | "hours"
): Boxes {
  if (totalSeconds == null) return { h: "", m: "", s: "" };
  const total = Math.max(0, Math.round(totalSeconds));
  if (maxUnit === "hours") {
    return {
      h: String(Math.floor(total / 3600)),
      m: String(Math.floor((total % 3600) / 60)),
      s: String(total % 60),
    };
  }
  return { h: "", m: String(Math.floor(total / 60)), s: String(total % 60) };
}

/** Inverse of decomposeSeconds. All three boxes blank means "unset" (null);
 * any other combination treats its blank boxes as zero, per the spec's
 * "90 seconds can be typed as (blank) : 1 : 30". */
function composeSeconds(boxes: Boxes, maxUnit: "minutes" | "hours"): number | null {
  if (boxes.h === "" && boxes.m === "" && boxes.s === "") return null;
  const h = maxUnit === "hours" ? Number(boxes.h) : 0;
  return h * 3600 + Number(boxes.m) * 60 + Number(boxes.s);
}

type DurationInputBaseProps = {
  /** "minutes" renders mm:ss (a rest/work/interval timer); "hours" renders
   * h:mm:ss (a cap or a race time that can run past an hour). */
  maxUnit: "minutes" | "hours";
  className?: string;
};

type UncontrolledDurationInputProps = DurationInputBaseProps & {
  /** Uncontrolled mode: contributes one seconds value under this name via
   * a hidden input, for forms read through FormData on submit. */
  name: string;
  defaultValueSeconds?: number | null;
};

type ControlledDurationInputProps = DurationInputBaseProps & {
  /** Controlled mode: for a reducer-driven form where every keystroke
   * needs to dispatch. Mutually exclusive with the uncontrolled props. */
  valueSeconds: number | null;
  onChange: (seconds: number | null) => void;
};

export type DurationInputProps =
  | UncontrolledDurationInputProps
  | ControlledDurationInputProps;

const boxClassName =
  "h-11 w-14 rounded-md border border-hairline bg-surface-1 px-1 text-center text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/**
 * A segmented duration input — separate h/m/s boxes rather than one parsed
 * string, so there's no format to guess. Value in and out is always a
 * number of seconds (or null when every box is blank); minutes/seconds
 * boxes are capped at 0-59, hours at 0-99.
 *
 * Supports two usages from one component, distinguished by which props are
 * passed (see DurationInputProps): uncontrolled (`name` +
 * `defaultValueSeconds`) mirrors the computed total into a hidden input for
 * forms that read FormData on submit (PersonalRecordFields, GoalFields);
 * controlled (`valueSeconds` + `onChange`) is for the workout builder's
 * reducer, where every keystroke must dispatch. One component instead of
 * two thin ones because the box markup and the decompose/compose math are
 * the entire implementation — duplicating them across two files would be
 * the split with nothing behind it.
 *
 * Each box keeps its own local text state rather than being derived fresh
 * from `valueSeconds`/`defaultValueSeconds` on every render: a controlled
 * number input re-rendered with a normalized value (e.g. "0" for a
 * just-cleared box) fights the browser's own cursor/leading-zero handling
 * on the next keystroke. Local state sidesteps that; the only place
 * `defaultValueSeconds`/`valueSeconds` is read is the initial decomposition
 * (both are only ever meant to seed the field once — the edit pre-fill —
 * not to be re-pushed in from outside afterwards). A caller that resets the
 * underlying value out from under a mounted controlled instance (e.g.
 * BlockEditor clearing timing fields on a block_type change) must force a
 * fresh instance with `key` — see BlockEditor.
 *
 * No `required` prop: a hidden input is barred from native constraint
 * validation by the HTML spec regardless of the attribute, so it wouldn't
 * do anything for the uncontrolled case; the controlled case (the builder)
 * has no native <form> submission to begin with. Every caller already
 * falls back to the shared server-side validators for this, same as the
 * exerciseId/customName and targetType/targetPreset either-or fields
 * elsewhere in these same forms.
 */
export default function DurationInput(props: DurationInputProps) {
  const { maxUnit, className } = props;
  const isControlled = "onChange" in props;

  const [boxes, setBoxes] = useState<Boxes>(() =>
    decomposeSeconds(
      isControlled ? props.valueSeconds : (props.defaultValueSeconds ?? null),
      maxUnit
    )
  );

  function updateBox(key: keyof Boxes, raw: string, max: number) {
    const next = { ...boxes, [key]: clampBox(raw, max) };
    setBoxes(next);
    if (isControlled) {
      props.onChange(composeSeconds(next, maxUnit));
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      {maxUnit === "hours" && (
        <>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_HOURS}
            step={1}
            value={displayBox(boxes.h)}
            onChange={(e) => updateBox("h", e.target.value, MAX_HOURS)}
            aria-label="Hours"
            className={boxClassName}
          />
          <span className="text-ink-subtle">:</span>
        </>
      )}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_MINUTES_OR_SECONDS}
        step={1}
        value={displayBox(boxes.m)}
        onChange={(e) => updateBox("m", e.target.value, MAX_MINUTES_OR_SECONDS)}
        aria-label="Minutes"
        className={boxClassName}
      />
      <span className="text-ink-subtle">:</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_MINUTES_OR_SECONDS}
        step={1}
        value={displayBox(boxes.s)}
        onChange={(e) => updateBox("s", e.target.value, MAX_MINUTES_OR_SECONDS)}
        aria-label="Seconds"
        className={boxClassName}
      />
      {!isControlled && (
        <input
          type="hidden"
          name={props.name}
          value={composeSeconds(boxes, maxUnit) ?? ""}
        />
      )}
    </div>
  );
}

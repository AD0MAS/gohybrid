"use client";

import { useState, type ChangeEvent } from "react";
import type { DigitLimit } from "@/lib/numeric-limits";
import {
  numberInputGuardProps,
  sanitizeNumberInputChange,
} from "./sanitize-live-number";

type NumberFieldProps = {
  name: string;
  step: number;
  min?: number;
  required?: boolean;
  digitLimit: DigitLimit;
  allowDecimal: boolean;
  /** Seeds local state on mount — the same string a plain uncontrolled
   * `defaultValue` would have received (fieldDefault's echoed-submission
   * value, or the entry's own formatted value). Only read once, at mount;
   * changing it on an already-mounted instance does nothing. A caller whose
   * field's meaning changes out from under it (recordType, targetMetricType,
   * …) must force a fresh mount with `key`, the same idiom DurationInput/
   * DistanceInput already use for the same reason — see this component's
   * three call sites. */
  initialValue: string | undefined;
  placeholder?: string;
  className?: string;
};

/**
 * A controlled `<input type="number">` with per-keystroke correction via
 * sanitizeNumberInputChange — the /profile forms' (BodyMetricFields,
 * PersonalRecordFields, GoalFields) counterpart to the workout builder's own
 * plain number fields (ItemEditor/BlockEditor/WorkoutBuilder), which
 * dispatch through a reducer instead of local state but otherwise run
 * through the exact same sanitizeNumberInputChange + numberInputGuardProps
 * pair. Replaces the old uncontrolled `defaultValue` + onBlur-only
 * correction: onBlur only canonicalised once the user left the field, so
 * leading zeros and over-length numbers were freely typable until then —
 * this corrects on every keystroke instead, same as every other numeric
 * field in the app.
 *
 * Still submits via FormData like any other field in these Server Action
 * forms — a controlled input is a real DOM element with a real `name`
 * attribute; FormData reads whatever the live DOM `.value` is at submit
 * time, the same way it would an uncontrolled input. Controlled vs.
 * uncontrolled only changes how `.value` gets *set* on re-render, not
 * whether the browser can read it back out.
 */
export default function NumberField({
  name,
  step,
  min,
  required,
  digitLimit,
  allowDecimal,
  initialValue,
  placeholder,
  className,
}: NumberFieldProps) {
  const [value, setValue] = useState<number | null>(
    initialValue ? Number(initialValue) : null
  );

  return (
    <input
      type="number"
      name={name}
      step={step}
      min={min}
      required={required}
      value={value ?? ""}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        setValue(sanitizeNumberInputChange(e, { min, digitLimit, allowDecimal }))
      }
      placeholder={placeholder}
      {...numberInputGuardProps({ allowDecimal })}
      className={className}
    />
  );
}

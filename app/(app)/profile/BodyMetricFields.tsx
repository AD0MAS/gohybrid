"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { bodyMetricTypeEnum, unitSystemEnum } from "@/db/schema";
import { formatBodyMetricValue } from "@/lib/units";
import Modal from "../_components/Modal";
import { addBodyMetric, type BodyMetricFormState } from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";

type BodyMetricFieldsProps = {
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
};

const initialState: BodyMetricFormState = { status: "idle" };

/**
 * The add-measurement form as a client component, needed for
 * useActionState: a validation failure from addBodyMetric renders here as
 * { status: "error", error } above the submit button instead of throwing
 * into app/error.tsx. The value input's placeholder shows the unit the
 * user is actually expected to type in (e.g. "Value (lb)" under imperial)
 * — via formatBodyMetricValue(metricType, 0, unitSystem).unit; the dummy
 * value 0 is safe here because weight/body_fat/resting_hr's unit never
 * depends on the value, only on unitSystem (unlike a distance PR's unit —
 * see PersonalRecordFields). The metric_type select needs local state
 * (unlike the old uncontrolled version) so the placeholder can react to
 * it. addBodyMetric (body-metrics-actions.ts) does the actual
 * imperial→metric conversion server-side — this component only ever
 * displays a unit, never converts a value.
 *
 * The form itself lives inside a Modal, opened by the button rendered
 * alongside it: `open` is local state, closed only once addBodyMetric's
 * state actually reaches "success" — an error leaves it open so the user
 * can fix and resubmit without retyping. That close is done during render
 * (comparing the state object's identity against prevState), not in a
 * useEffect, since setState in an effect just to react to another piece
 * of React state is the pattern React's own docs steer away from in
 * favour of adjusting state directly while rendering. The comparison uses
 * `state !== prevState` — object identity, not `state.status !==
 * prevStatus` — because addBodyMetric returns a fresh object literal on
 * every call: comparing only the `.status` string would miss two
 * consecutive identical statuses (e.g. a second successful submission
 * right after the first), since "success" === "success" leaves the check
 * unable to tell "still the old result" from "a new result that happens
 * to match."
 */
export default function BodyMetricFields({
  today,
  unitSystem,
}: BodyMetricFieldsProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addBodyMetric, initialState);
  const [metricType, setMetricType] =
    useState<(typeof bodyMetricTypeEnum.enumValues)[number]>("weight");
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setOpen(false);
  }

  const { unit } = formatBodyMetricValue(metricType, 0, unitSystem);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        <Plus className="h-4 w-4" />
        Add measurement
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add measurement">
        <form action={formAction} className="flex flex-col gap-3">
          <select
            name="metricType"
            value={metricType}
            onChange={(e) =>
              setMetricType(
                e.target.value as (typeof bodyMetricTypeEnum.enumValues)[number]
              )
            }
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {bodyMetricTypeEnum.enumValues.map((type) => (
              <option key={type} value={type}>
                {BODY_METRIC_LABELS[type].label}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="value"
            step="0.01"
            min="0"
            required
            placeholder={`Value (${unit})`}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <input
            type="date"
            name="measuredAt"
            defaultValue={today}
            max={today}
            required
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <input
            type="text"
            name="notes"
            placeholder="Notes (optional)"
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          {state.status === "error" && (
            <p className="text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Add measurement
          </button>
        </form>
      </Modal>
    </>
  );
}

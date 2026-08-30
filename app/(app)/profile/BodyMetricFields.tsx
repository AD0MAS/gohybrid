"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { bodyMetricTypeEnum, unitSystemEnum } from "@/db/schema";
import type { BodyMetric } from "@/lib/body-metrics";
import { formatBodyMetricValue } from "@/lib/units";
import Modal from "../_components/Modal";
import {
  addBodyMetric,
  updateBodyMetric,
  type BodyMetricFormState,
} from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";

type BodyMetricFieldsProps = {
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  /** Absent renders the Add-measurement button + form; present renders a
   * Pencil edit trigger + the same form pre-filled from this entry,
   * submitting to updateBodyMetric instead of addBodyMetric. */
  entry?: BodyMetric;
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
 *
 * When `entry` is present, this same component renders as BodyMetricsList's
 * per-row edit trigger instead of the section's Add button: a Pencil
 * icon-button in place of the Plus button, "Edit measurement"/"Save"
 * copy, and every field's local state/defaultValue seeded from `entry`.
 * `updateBodyMetric.bind(null, entry.id)` is used as the form action in
 * place of addBodyMetric — the bound function still matches
 * useActionState's (prevState, formData) signature. The value input is
 * pre-filled via formatBodyMetricValue(entry.metricType, entry.value,
 * unitSystem) — the same display conversion the list renders each entry
 * through — so an imperial user editing a weight sees (and can resubmit)
 * the value in lb, not the raw stored kg.
 */
export default function BodyMetricFields({
  today,
  unitSystem,
  entry,
}: BodyMetricFieldsProps) {
  const [open, setOpen] = useState(false);
  const action = entry ? updateBodyMetric.bind(null, entry.id) : addBodyMetric;
  const [state, formAction] = useActionState(action, initialState);
  const [metricType, setMetricType] =
    useState<(typeof bodyMetricTypeEnum.enumValues)[number]>(
      entry?.metricType ?? "weight"
    );
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setOpen(false);
  }

  const { unit } = formatBodyMetricValue(metricType, 0, unitSystem);
  const defaultValue = entry
    ? formatBodyMetricValue(entry.metricType, entry.value, unitSystem).value
    : undefined;

  return (
    <>
      {entry ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Plus className="h-4 w-4" />
          Add measurement
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit measurement" : "Add measurement"}>
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
            defaultValue={defaultValue}
            placeholder={`Value (${unit})`}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <input
            type="date"
            name="measuredAt"
            defaultValue={entry?.measuredAt ?? today}
            max={today}
            required
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          <input
            type="text"
            name="notes"
            placeholder="Notes (optional)"
            defaultValue={entry?.notes ?? ""}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />

          {state.status === "error" && (
            <p className="text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            {entry ? "Save" : "Add measurement"}
          </button>
        </form>
      </Modal>
    </>
  );
}

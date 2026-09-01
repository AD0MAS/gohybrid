"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { bodyMetricTypeEnum, unitSystemEnum } from "@/db/schema";
import { FormPendingBanner, FormSuccessBanner, SubmitButton } from "@/app/_components/FormStatus";
import type { BodyMetric } from "@/lib/body-metrics";
import { formatBodyMetricValue } from "@/lib/units";
import { isOneOf } from "@/lib/workouts-validation";
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
 * The Add/Edit trigger plus the Modal shell: owns `open`, the
 * useActionState pair, and `formKey` — everything that must survive across
 * the modal opening and closing, since this component itself is never
 * unmounted (Modal always keeps its children mounted and only toggles the
 * native <dialog> via open/close — see Modal's own doc comment). The actual
 * fields live in BodyMetricFormFields below, mounted fresh on every open
 * (see openFresh) so a reopen can never show whatever type/value was last
 * selected and abandoned rather than `entry` as stored — see the bug this
 * split fixed: previously only the <form> DOM node remounted on a failed
 * submit, which is enough to fix plain uncontrolled fields (their defaultValue
 * is just re-read), but not `metricType`, a *controlled* select — its
 * displayed value comes from a useState in the component that owns it, and
 * remounting a <form> one level below that component does nothing to reset
 * it. Splitting the fields into their own component and keying *that*
 * component on `formKey` is what actually resets it: a full remount re-runs
 * every one of BodyMetricFormFields' useState initializers from `entry`
 * again, with no field left out (the alternative — resetting each piece of
 * state by hand on open — would need every one listed and would silently
 * miss any added later).
 *
 * `open` is local state, closed only once addBodyMetric's state actually
 * reaches "success" — an error leaves it open so the user can fix and
 * resubmit without retyping. That close is done during render (comparing
 * the state object's identity against prevState), not in a useEffect, since
 * setState in an effect just to react to another piece of React state is
 * the pattern React's own docs steer away from in favour of adjusting state
 * directly while rendering. The comparison uses `state !== prevState` —
 * object identity, not `state.status !== prevStatus` — because
 * addBodyMetric returns a fresh object literal on every call: comparing
 * only the `.status` string would miss two consecutive identical statuses
 * (e.g. a second successful submission right after the first), since
 * "success" === "success" leaves the check unable to tell "still the old
 * result" from "a new result that happens to match."
 *
 * `errorActive` answers a question `state`'s own identity can't: whether
 * the error it's currently holding (if any) still belongs to the session
 * that's open right now, or is left over from one the user dismissed
 * without fixing (Esc, the X, a backdrop click — none of those reset
 * `state`, since none of them submit the form). Without it, reopening after
 * an abandoned error would still compute `submitted` from that stale
 * `state.status === "error"` and hand BodyMetricFormFields the abandoned
 * attempt's echoed values instead of `entry`'s — the exact bug this whole
 * change fixes, just reached through the error path instead of the
 * type-switch-then-close one. `visibleState` is what BodyMetricFormFields
 * actually receives as `state`: the real error while `errorActive`, and
 * `initialState` otherwise, so it never has to know any of this itself.
 *
 * When `entry` is present, this same component renders as BodyMetricsList's
 * per-row edit trigger instead of the section's Add button: a Pencil
 * icon-button in place of the Plus button, "Edit measurement"/"Save" copy.
 * `updateBodyMetric.bind(null, entry.id)` is used as the form action in
 * place of addBodyMetric — the bound function still matches
 * useActionState's (prevState, formData) signature.
 */
export default function BodyMetricFields({
  today,
  unitSystem,
  entry,
}: BodyMetricFieldsProps) {
  const [open, setOpen] = useState(false);
  const action = entry ? updateBodyMetric.bind(null, entry.id) : addBodyMetric;
  const [state, formAction] = useActionState(action, initialState);
  const [prevState, setPrevState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  const [errorActive, setErrorActive] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") {
      setOpen(false);
      setSuccessCount((count) => count + 1);
    } else if (state.status === "error") {
      setFormKey((key) => key + 1);
      setErrorActive(true);
    }
  }
  const visibleState: BodyMetricFormState = errorActive ? state : initialState;

  function openFresh() {
    setFormKey((key) => key + 1);
    setErrorActive(false);
    setOpen(true);
  }

  return (
    <>
      <FormSuccessBanner trigger={successCount} />
      {entry ? (
        <button
          type="button"
          onClick={openFresh}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openFresh}
          className="flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Plus className="h-4 w-4" />
          Add measurement
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit measurement" : "Add measurement"}>
        <BodyMetricFormFields
          key={formKey}
          today={today}
          unitSystem={unitSystem}
          entry={entry}
          state={visibleState}
          formAction={formAction}
        />
      </Modal>
    </>
  );
}

type BodyMetricFormFieldsProps = {
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  entry?: BodyMetric;
  state: BodyMetricFormState;
  formAction: (formData: FormData) => void;
};

/**
 * The form's actual fields, split out from BodyMetricFields (see its doc
 * comment) so the parent can mount a fresh instance of this component —
 * keyed on `formKey` — on every open, not just on a failed submit.
 *
 * The value input's placeholder tracks the selected metric type — via
 * formatBodyMetricValue(metricType, 0, unitSystem).unit; the dummy value 0
 * is safe here because weight/body_fat/resting_hr's unit never depends on
 * the value, only on unitSystem (unlike a distance PR's unit — see
 * PersonalRecordFields). addBodyMetric (body-metrics-actions.ts) does the
 * actual imperial→metric conversion server-side — this component only ever
 * displays a unit, never converts a value. The value input is pre-filled
 * via formatBodyMetricValue(entry.metricType, entry.value, unitSystem) — the
 * same display conversion the list renders each entry through — so an
 * imperial user editing a weight sees (and can resubmit) the value in lb,
 * not the raw stored kg.
 *
 * `state` arrives already resolved by the parent to whatever should
 * genuinely be visible this mount (see BodyMetricFields' `visibleState`) —
 * every read of `state`/`submitted` below stays exactly the shape it always
 * was, this component just doesn't have to know why. `metricType`'s
 * initializer prefers `submitted.metricType` over `entry`'s own: while
 * `state` is a live error (this component was just remounted because a
 * submission failed, not because the modal was freshly reopened),
 * `submitted` holds what the user actually just tried to submit, and that
 * must win over `entry`'s original value — the whole point of a failed
 * submit remounting this component at all is to restore what was typed,
 * same as GoalFields.
 */
function BodyMetricFormFields({
  today,
  unitSystem,
  entry,
  state,
  formAction,
}: BodyMetricFormFieldsProps) {
  const submitted = state.status === "error" ? state.values : null;
  function fieldDefault(name: string, fallback?: string): string | undefined {
    return submitted?.[name] ?? fallback;
  }

  const [metricType, setMetricType] =
    useState<(typeof bodyMetricTypeEnum.enumValues)[number]>(
      isOneOf(submitted?.metricType, bodyMetricTypeEnum.enumValues)
        ? submitted.metricType
        : entry?.metricType ?? "weight"
    );

  const { unit } = formatBodyMetricValue(metricType, 0, unitSystem);
  const defaultValue =
    entry && entry.metricType === metricType
      ? formatBodyMetricValue(entry.metricType, entry.value, unitSystem).value
      : undefined;
  // A scale reads to 0.1 kg/lb; body fat % follows the same precision;
  // resting HR is always a whole beats-per-minute reading.
  const valueStep = metricType === "resting_hr" ? 1 : 0.1;

  return (
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
        step={valueStep}
        min="0"
        required
        defaultValue={fieldDefault(
          "value",
          defaultValue !== undefined ? String(defaultValue) : undefined
        )}
        placeholder={`Value (${unit})`}
        className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      />

      <input
        type="date"
        name="measuredAt"
        defaultValue={fieldDefault("measuredAt", entry?.measuredAt ?? today)}
        max={today}
        required
        className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      />

      <input
        type="text"
        name="notes"
        placeholder="Notes (optional)"
        defaultValue={fieldDefault("notes", entry?.notes ?? "")}
        className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      />

      {state.status === "error" && (
        <p className="text-sm text-danger">{state.error}</p>
      )}

      <SubmitButton className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
        {entry ? "Save" : "Add measurement"}
      </SubmitButton>
      <FormPendingBanner />
    </form>
  );
}

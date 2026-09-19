"use client";

import { useActionState, useId, useState } from "react";
import { Pencil } from "lucide-react";
import { bodyMetricTypeEnum, unitSystemEnum } from "@/db/schema";
import {
  FormErrorMessage,
  FormPendingBanner,
  FormSuccessBanner,
  SubmitButton,
} from "@/app/_components/FormStatus";
import type { BodyMetric } from "@/lib/body-metrics";
import {
  BODY_FAT_DIGIT_LIMIT,
  BODY_WEIGHT_DIGIT_LIMIT,
  RESTING_HR_DIGIT_LIMIT,
} from "@/lib/numeric-limits";
import { BODY_METRIC_NOTES_MAX_LENGTH } from "@/lib/text-limits";
import { formatBodyMetricValue } from "@/lib/units";
import { isOneOf } from "@/lib/workouts-validation";
import Modal from "../_components/Modal";
import NumberField from "../_components/NumberField";
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
  /** Only meaningful when `entry` is absent: renders the default
   * Add-measurement trigger as a full CTA button with this label instead of
   * the quiet header-style text link — BodyMetricsList's empty state passes
   * "Add a measurement". A plain string, not a renderTrigger callback (an
   * earlier version of this prop): BodyMetricsList, which needs this
   * variant, is a Server Component, and only serializable props — never
   * functions — can cross into a Client Component like this one. */
  ctaLabel?: string;
  /** Only meaningful when `ctaLabel` is also set: hides the CTA button
   * itself via `hidden` (display: none) without unmounting this component
   * — BodyMetricsList's hero instance passes this once a measurement exists,
   * instead of BodyMetricsList conditionally rendering (and thereby
   * destroying) the instance itself. See BodyMetricsList's own doc comment
   * for why: this component's `successCount`/FormSuccessBanner state must
   * survive the exact render that flips the section from empty to
   * non-empty, since that's the one save whose own success would otherwise
   * be discarded by unmounting the very instance that just recorded it. */
  hidden?: boolean;
  /** Where to come back to when this edit changes the metric type, which
   * moves the entry to another type's list and unmounts its form (and the
   * banner it would show) — see lib/redirect-back.ts. Only meaningful with
   * `entry`. */
  returnTo?: string;
};

const initialState: BodyMetricFormState = { status: "idle" };

// w-full sm:w-auto matches GoalFields' own empty-state button ("Set your
// first goal") — every empty-state CTA in /profile spans the full panel
// width below sm and sizes to its own text from sm up.
const CTA_CLASSES =
  "flex h-10 w-full items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto";

// The section heading's own trigger, rebuilt from BodyMetricTypeTabs' own tab
// button (the closest existing "small secondary button inside a panel"):
// rounded-control, border, px-4 py-1.5 (this is what gives the height — no
// separate h-* class, same as the tabs), text-xs font-medium, and the same
// focus ring, copied as-is. Two deliberate departures from an inactive tab:
// bg-surface-2 (the panel behind it is bg-surface-1 — one step darker — so
// surface-2 is one step lighter, same value the tabs already rest at, chosen
// so the button reads as raised rather than an outlined hole) with text-ink
// rather than text-ink-subtle, since this is the section's one primary
// action and should carry more visual weight than an inactive tab's muted
// label. hover:/active: reuse the tabs' own *active-tab* values
// (border-hairline-strong, bg-surface-3) as the pressed/hovered state — the
// same transition the tabs already define between their two states, just
// triggered by a pseudo-class instead of a click, and active: mirrors hover:
// per the app-wide touch-feedback convention (see globals.css/CLAUDE.md).
const HEADER_TRIGGER_CLASSES =
  "rounded-control border border-hairline bg-surface-2 px-4 py-1.5 text-xs font-medium text-ink hover:border-hairline-strong hover:bg-surface-3 active:border-hairline-strong active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

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
  ctaLabel,
  hidden = false,
  returnTo,
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

  function submit(formData: FormData) {
    if (entry && returnTo && formData.get("metricType") !== entry.metricType) {
      formData.set("returnTo", returnTo);
    }
    formAction(formData);
  }

  return (
    <>
      <FormSuccessBanner trigger={successCount} label="Saved" />
      {entry ? (
        <button
          type="button"
          onClick={openFresh}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-small border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : ctaLabel ? (
        // Swaps the whole className rather than adding a `hidden` attribute
        // alongside CTA_CLASSES' own `flex` — see GoalFields' matching
        // button for why: `flex` is author-origin and would beat the
        // user-agent-origin `[hidden]` rule regardless of order.
        <button
          type="button"
          onClick={openFresh}
          className={hidden ? "hidden" : CTA_CLASSES}
        >
          {ctaLabel}
        </button>
      ) : (
        <button type="button" onClick={openFresh} className={HEADER_TRIGGER_CLASSES}>
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
          formAction={submit}
          onCancel={() => setOpen(false)}
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
  /** Closes the modal without submitting — see GoalFields' matching
   * onCancel doc comment. */
  onCancel: () => void;
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
  onCancel,
}: BodyMetricFormFieldsProps) {
  const uid = useId();
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
  // A scale reads to 0.1 kg/lb; body fat % follows the same precision —
  // both use "any" to disable native step validation (BODY_WEIGHT_DIGIT_
  // LIMIT/BODY_FAT_DIGIT_LIMIT already bound the decimal budget to 1 place;
  // step 0.1 additionally made the spinner arrows crawl one-tenth at a
  // time). Resting HR is always a whole beats-per-minute reading, so it
  // keeps a real step of 1.
  const valueStep: number | "any" = metricType === "resting_hr" ? 1 : "any";
  const valueDigitLimit =
    metricType === "weight"
      ? BODY_WEIGHT_DIGIT_LIMIT
      : metricType === "body_fat"
        ? BODY_FAT_DIGIT_LIMIT
        : RESTING_HR_DIGIT_LIMIT;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-metricType`} className="text-xs font-medium text-ink-subtle">
          Metric type
        </label>
        <select
          id={`${uid}-metricType`}
          name="metricType"
          value={metricType}
          onChange={(e) =>
            setMetricType(
              e.target.value as (typeof bodyMetricTypeEnum.enumValues)[number]
            )
          }
          className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          {bodyMetricTypeEnum.enumValues.map((type) => (
            <option key={type} value={type}>
              {BODY_METRIC_LABELS[type].label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-value`} className="text-xs font-medium text-ink-subtle">
          {`Value (${unit})`}
        </label>
        <NumberField
          key={metricType}
          id={`${uid}-value`}
          name="value"
          step={valueStep}
          // min: 1 for all three — a body weight, body fat %, or resting
          // heart rate of 0 is meaningless (fix 3: the same "correct the
          // value while typing" approach as the builder's own numeric
          // fields), so a typed 0 is corrected to 1 before it ever reaches
          // this component's state.
          min={1}
          required
          digitLimit={valueDigitLimit}
          allowDecimal={metricType !== "resting_hr"}
          initialValue={fieldDefault(
            "value",
            defaultValue !== undefined ? String(defaultValue) : undefined
          )}
          placeholder={`Value (${unit})`}
          className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-measuredAt`} className="text-xs font-medium text-ink-subtle">
          Date measured
        </label>
        <input
          type="date"
          id={`${uid}-measuredAt`}
          name="measuredAt"
          defaultValue={fieldDefault("measuredAt", entry?.measuredAt ?? today)}
          max={today}
          required
          className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-notes`} className="text-xs font-medium text-ink-subtle">
          Notes (optional)
        </label>
        <input
          type="text"
          id={`${uid}-notes`}
          name="notes"
          placeholder="Notes (optional)"
          defaultValue={fieldDefault("notes", entry?.notes ?? "")}
          maxLength={BODY_METRIC_NOTES_MAX_LENGTH}
          className="h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </div>

      <FormErrorMessage
        error={state.status === "error" ? state.error : null}
      />

      <div className="mt-1 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-base text-ink hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Cancel
        </button>
        <SubmitButton className="flex h-11 items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
          {entry ? "Save" : "Add measurement"}
        </SubmitButton>
      </div>
      <FormPendingBanner label="Saving…" />
    </form>
  );
}

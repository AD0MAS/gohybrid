"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { personalRecordTypeEnum, unitSystemEnum } from "@/db/schema";
import { FormPendingBanner, FormSuccessBanner, SubmitButton } from "@/app/_components/FormStatus";
import { groupExercisesForSelect, type GroupableExercise } from "@/lib/exercise-groups";
import {
  CALORIES_DIGIT_LIMIT,
  DISTANCE_DIGIT_LIMIT,
  LIFTED_WEIGHT_DIGIT_LIMIT,
  REPS_DIGIT_LIMIT,
} from "@/lib/numeric-limits";
import type { PersonalRecord } from "@/lib/personal-records";
import {
  convertDistanceInputToMetres,
  DISTANCE_INPUT_UNITS,
  formatPersonalRecordValue,
  type DistanceInputUnit,
} from "@/lib/units";
import { isOneOf } from "@/lib/workouts-validation";
import DistanceInput from "../_components/DistanceInput";
import DurationInput from "../_components/DurationInput";
import Modal from "../_components/Modal";
import NumberField from "../_components/NumberField";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import {
  addPersonalRecord,
  updatePersonalRecord,
  type PersonalRecordFormState,
} from "./personal-records-actions";

type CatalogExercise = GroupableExercise;

type PersonalRecordFieldsProps = {
  catalog: CatalogExercise[];
  /** This user's distinct past custom_name values (getDistinctCustomNamesForUser,
   * lib/personal-records.ts), offered as a "Previously used" group in the
   * exercise <select> below so a subject can be picked again instead of
   * retyped — see the select's own comment for the value-encoding scheme. */
  customNames: string[];
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  /** Absent renders the Add-record button + form; present renders a Pencil
   * edit trigger + the same form pre-filled from this entry, submitting to
   * updatePersonalRecord instead of addPersonalRecord. */
  entry?: PersonalRecord;
};

const initialState: PersonalRecordFormState = { status: "idle" };

/** Prefix marking a <select> value as one of `customNames` rather than a
 * catalog exercise id or the "type a new name" sentinel ("") — see the
 * exercise <select>'s own comment below for the full value-encoding scheme.
 * Safe against collision with a real exercise id: those are always UUIDs,
 * which never contain a colon. */
const EXISTING_CUSTOM_PREFIX = "existing:";

/**
 * The Add/Edit trigger plus the Modal shell: owns `open`, the
 * useActionState pair, and `formKey` — everything that must survive across
 * the modal opening and closing, since this component itself is never
 * unmounted (Modal always keeps its children mounted and only toggles the
 * native <dialog> via open/close — see Modal's own doc comment). The actual
 * fields live in PersonalRecordFormFields below, mounted fresh on every open
 * (see openFresh) so a reopen can never show whatever subject/type/value was
 * last selected and abandoned rather than `entry` as stored.
 *
 * This split exists because a failed submit's `formKey` bump alone (the
 * original mechanism) only remounts the <form> DOM node — enough to fix
 * plain uncontrolled fields (their defaultValue is just re-read), but not
 * `recordType`/the exercise-or-custom-name selection, both *controlled*: a
 * controlled element's displayed value comes from a useState in whichever
 * component owns it, and remounting a <form> one level below that component
 * does nothing to reset it. Moving that state into its own component and
 * keying *that* component on `formKey` is what actually resets it: a full
 * remount re-runs every one of PersonalRecordFormFields' useState
 * initializers from `entry` again, with no field left out — the
 * alternative, resetting each piece of state by hand on open, would need
 * every one listed and would silently miss any added later.
 *
 * `open` is local state, closed only once addPersonalRecord's state actually
 * reaches "success" — an error leaves it open so the user can fix and
 * resubmit without retyping. That close is done during render (comparing
 * the state object's identity against prevState), not in a useEffect, since
 * setState in an effect just to react to another piece of React state is
 * the pattern React's own docs steer away from in favour of adjusting state
 * directly while rendering. The comparison uses `state !== prevState` —
 * object identity, not `state.status !== prevStatus` — because
 * addPersonalRecord returns a fresh object literal on every call: comparing
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
 * `state.status === "error"` and hand PersonalRecordFormFields the
 * abandoned attempt's echoed values instead of `entry`'s — the exact bug
 * this whole change fixes, just reached through the error path instead of
 * the type-switch-then-close one. `visibleState` is what
 * PersonalRecordFormFields actually receives as `state`: the real error
 * while `errorActive`, and `initialState` otherwise, so it never has to
 * know any of this itself.
 *
 * When `entry` is present, this same component renders as
 * PersonalRecordsList's per-row edit trigger instead of the section's Add
 * button: a Pencil icon-button in place of the Plus button, "Edit
 * record"/"Save" copy. `updatePersonalRecord.bind(null, entry.id)` is used
 * as the form action in place of addPersonalRecord — the bound function
 * still matches useActionState's (prevState, formData) signature.
 */
export default function PersonalRecordFields({
  catalog,
  customNames,
  today,
  unitSystem,
  entry,
}: PersonalRecordFieldsProps) {
  const [open, setOpen] = useState(false);
  const action = entry
    ? updatePersonalRecord.bind(null, entry.id)
    : addPersonalRecord;
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
  const visibleState: PersonalRecordFormState = errorActive
    ? state
    : initialState;

  function openFresh() {
    setFormKey((key) => key + 1);
    setErrorActive(false);
    setOpen(true);
  }

  return (
    <>
      <FormSuccessBanner trigger={successCount} label="Saved" />
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
        <>
          <button
            type="button"
            onClick={openFresh}
            aria-label="Add record"
            className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:hidden"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={openFresh}
            className="hidden h-11 items-center gap-2 rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:flex"
          >
            <Plus className="h-4 w-4" />
            Add record
          </button>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit record" : "Add record"}>
        <PersonalRecordFormFields
          key={formKey}
          catalog={catalog}
          customNames={customNames}
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

/** Re-derives the exercise <select>'s own encoded value (see its inline
 * comment in PersonalRecordFormFields for the value space) for a fresh
 * mount: from `submitted`'s echoed exerciseId/customName while an error is
 * still live for this session (so the subject the user actually submitted
 * survives the remount, same principle as every other field restored from
 * `submitted`), otherwise from `entry`. A submitted customName that matches
 * one of `customNames` restores the "previously used" selection; one that
 * doesn't falls back to "Custom (new)…" with the text itself still restored
 * by fieldDefault — the submitted subject is preserved either way, just
 * not always via the identical control it was entered through.
 */
function deriveSubjectSelection(
  submitted: Record<string, string> | null,
  entry: PersonalRecord | undefined,
  catalog: CatalogExercise[],
  customNames: string[]
): string {
  if (submitted) {
    const exerciseId = submitted.exerciseId;
    if (exerciseId && catalog.some((exercise) => exercise.id === exerciseId)) {
      return exerciseId;
    }
    const customName = submitted.customName;
    if (customName) {
      const match = customNames.find((name) => name === customName);
      return match ? `${EXISTING_CUSTOM_PREFIX}${match}` : "";
    }
    return "";
  }
  return entry?.exerciseId ?? "";
}

type PersonalRecordFormFieldsProps = {
  catalog: CatalogExercise[];
  customNames: string[];
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  entry?: PersonalRecord;
  state: PersonalRecordFormState;
  formAction: (formData: FormData) => void;
};

/**
 * The form's actual fields, split out from PersonalRecordFields (see its
 * doc comment) so the parent can mount a fresh instance of this component —
 * keyed on `formKey` — on every open, not just on a failed submit. Merges
 * what were two concerns (the record-type/value pair, and the
 * exercise/custom-name choice) into one, since both need client state.
 * Three things need JS: (1) the value input's placeholder tracks the
 * selected record type AND, for distance, the selected exercise (a HYROX
 * station locks DistanceInput to metres — see its own doc comment); (2) the
 * exercise select and the custom-name input are mutually exclusive — a
 * single `<select>` lists the catalog, a "Previously used" group of this
 * user's past custom_name values (`customNames`, prefixed with
 * EXISTING_CUSTOM_PREFIX so a chosen name can't be mistaken for a catalog
 * exercise id), and a "Custom (new)…" option (value "") — the custom-name
 * text input only renders for that last option; picking a previously-used
 * name instead submits it via a hidden input (exerciseId/customName aren't
 * this <select>'s own `name` — see its inline comment). The server
 * (validatePersonalRecordInput) still rejects both/neither being present —
 * this UI just makes the common case impossible to get wrong.
 *
 * `state` arrives already resolved by the parent to whatever should
 * genuinely be visible this mount (see PersonalRecordFields' `visibleState`)
 * — every read of `state`/`submitted` below stays exactly the shape it
 * always was, this component just doesn't have to know why.
 * `recordType`/`subjectSelection`'s initializers prefer `submitted` over
 * `entry`'s own values: while `state` is a live error (this component was
 * just remounted because a submission failed, not because the modal was
 * freshly reopened), `submitted` holds what the user actually just tried to
 * submit, and that must win over `entry`'s original value — the whole point
 * of a failed submit remounting this component at all is to restore what
 * was typed, same as GoalFields.
 *
 * `fieldDefault`/`fieldDefaultSeconds` restore the plain uncontrolled
 * fields (customName, achievedAt, notes) and the value/DurationInput field
 * from `submitted` the same way. `fieldDefaultDistanceMetres`/
 * `fieldDefaultDistanceUnit` do the same for DistanceInput, but must
 * restore BOTH the number and the unit the user had selected — see their
 * own doc comment for why the unit can't just be re-derived from the
 * recovered metres value.
 */
function PersonalRecordFormFields({
  catalog,
  customNames,
  today,
  unitSystem,
  entry,
  state,
  formAction,
}: PersonalRecordFormFieldsProps) {
  const submitted = state.status === "error" ? state.values : null;
  function fieldDefault(name: string, fallback?: string): string | undefined {
    return submitted?.[name] ?? fallback;
  }
  function fieldDefaultSeconds(name: string, fallback: number | null): number | null {
    if (submitted && name in submitted) {
      const raw = submitted[name];
      return raw === "" ? null : Number(raw);
    }
    return fallback;
  }
  /**
   * DistanceInput's `defaultValueMetres` restore-on-error counterpart to
   * fieldDefaultSeconds. Re-derives metres from the echoed `${name}`/
   * `${name}Unit` pair via convertDistanceInputToMetres, using the unit the
   * user actually had selected — never DistanceInput's own metres-based
   * heuristic, which could reopen a different unit than the one submitted
   * (see DistanceInput's `defaultUnit` doc comment).
   */
  function fieldDefaultDistanceMetres(
    name: string,
    fallback: number | null
  ): number | null {
    if (submitted && name in submitted) {
      const raw = submitted[name];
      const unit = submitted[`${name}Unit`];
      if (raw === "" || !isOneOf(unit, DISTANCE_INPUT_UNITS)) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed)
        ? convertDistanceInputToMetres(parsed, unit)
        : null;
    }
    return fallback;
  }
  /** The unit half of fieldDefaultDistanceMetres — passed to DistanceInput
   * as `defaultUnit` so it pins exactly what was submitted instead of
   * re-guessing from the recovered metres value. undefined outside of
   * error-recovery, which leaves DistanceInput's own heuristic in charge. */
  function fieldDefaultDistanceUnit(name: string): DistanceInputUnit | undefined {
    const unit = submitted?.[`${name}Unit`];
    return isOneOf(unit, DISTANCE_INPUT_UNITS) ? unit : undefined;
  }

  const [subjectSelection, setSubjectSelection] = useState(() =>
    deriveSubjectSelection(submitted, entry, catalog, customNames)
  );
  const exerciseId = catalog.some((exercise) => exercise.id === subjectSelection)
    ? subjectSelection
    : null;
  const existingCustomName = subjectSelection.startsWith(EXISTING_CUSTOM_PREFIX)
    ? subjectSelection.slice(EXISTING_CUSTOM_PREFIX.length)
    : null;
  const isNewCustomName = exerciseId === null && existingCustomName === null;
  const [recordType, setRecordType] =
    useState<(typeof personalRecordTypeEnum.enumValues)[number]>(() =>
      isOneOf(submitted?.recordType, personalRecordTypeEnum.enumValues)
        ? submitted.recordType
        : entry?.recordType ?? "weight"
    );

  const isHyroxStation =
    catalog.find((exercise) => exercise.id === exerciseId)?.isHyroxStation ??
    false;

  const valueUnit = formatPersonalRecordValue(
    recordType,
    0,
    unitSystem,
    isHyroxStation
  ).unit;

  // Only pre-fills while the currently selected recordType still matches
  // entry's own stored type — switching recordType must not hand the new
  // type's input a value that was recorded (and means something different)
  // under the old one, and switching back doesn't restore it either, since
  // it's no longer what the user is editing. Distance is excluded here
  // regardless (it never uses this branch — see DistanceInput below).
  const defaultValue =
    entry && entry.recordType === recordType && entry.recordType !== "distance"
      ? formatPersonalRecordValue(
          entry.recordType,
          entry.value,
          unitSystem,
          isHyroxStation
        ).value
      : undefined;
  // "any" disables native step validation for weight — LIFTED_WEIGHT_DIGIT_
  // LIMIT allows any 0.1 (a plate increment like 2.5 rejected a typed 82.5's
  // own neighbours), and the spinner arrows default to incrementing by 1
  // regardless, per the HTML spec. Reps and calories are whole-number
  // counts (distance/time route through their own inputs above), so step 1
  // is both correct AND sufficient — "any" would be unnecessary for them.
  const valueStep: number | "any" = recordType === "weight" ? "any" : 1;
  // Weight stays at min: 0, not a positive floor — raising it would
  // reproduce the exact bug ItemEditor's own weight field had: the spinner
  // arrows count up from whatever min is, so min: 0.1 turned them into
  // 1.1/2.1/3.1 instead of whole numbers. Unlike ItemEditor's weight,
  // though, there's no 0-to-null correction here to compensate — this
  // field is `required` and has no "blank means bodyweight" reading, so a
  // typed 0 is a genuine error, not a value to silently convert. It's
  // rejected by validatePersonalRecordInput's own "must be greater than 0"
  // message instead (lib/personal-records-validation.ts) — the Server
  // Action is still the gate. Reps/calories keep min: 1 — whole-count
  // subjects with no equivalent "let the validator catch it" reason to
  // relax back to 0.
  const valueMin = recordType === "weight" ? 0 : 1;
  // Only reached for weight/reps/calories — time/distance render
  // DurationInput/DistanceInput above instead, which carry their own limit.
  const valueDigitLimit =
    recordType === "weight"
      ? LIFTED_WEIGHT_DIGIT_LIMIT
      : recordType === "calories"
        ? CALORIES_DIGIT_LIMIT
        : REPS_DIGIT_LIMIT;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {/*
        Not itself a form field (no `name`) — exerciseId/customName are
        submitted via the explicit inputs below instead, since this
        <select>'s value space is wider than either field alone: a
        catalog exercise id, one of `customNames` (prefixed so it can't
        collide with a real id), or "" for "type a new name". Collapsing
        that into a single controlled value here, rather than one state
        variable per field, is what lets picking a previously-used name
        and typing a brand new one share one control instead of two.
      */}
      <select
        value={subjectSelection}
        onChange={(e) => setSubjectSelection(e.target.value)}
        className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        <option value="">Custom (new)…</option>
        {customNames.length > 0 && (
          <optgroup label="Previously used">
            {customNames.map((name) => (
              <option
                key={name}
                value={`${EXISTING_CUSTOM_PREFIX}${name}`}
              >
                {name}
              </option>
            ))}
          </optgroup>
        )}
        {groupExercisesForSelect(catalog, { includeRest: false }).map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <input type="hidden" name="exerciseId" value={exerciseId ?? ""} />

      {isNewCustomName && (
        <input
          type="text"
          name="customName"
          placeholder="Custom name"
          defaultValue={fieldDefault("customName", entry?.customName ?? "")}
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      )}
      {existingCustomName !== null && (
        <input type="hidden" name="customName" value={existingCustomName} />
      )}

      <select
        name="recordType"
        value={recordType}
        onChange={(e) =>
          setRecordType(
            e.target.value as (typeof personalRecordTypeEnum.enumValues)[number]
          )
        }
        className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        {personalRecordTypeEnum.enumValues.map((type) => (
          <option key={type} value={type}>
            {PERSONAL_RECORD_LABELS[type].label}
          </option>
        ))}
      </select>

      {recordType === "time" ? (
        <DurationInput
          key="time"
          maxUnit="hours"
          name="value"
          defaultValueSeconds={fieldDefaultSeconds("value", defaultValue ?? null)}
        />
      ) : recordType === "distance" ? (
        <DistanceInput
          key={`distance-${isHyroxStation ? "hyrox" : "standard"}`}
          name="value"
          unitSystem={unitSystem}
          isHyroxStation={isHyroxStation}
          digitLimit={DISTANCE_DIGIT_LIMIT}
          defaultValueMetres={fieldDefaultDistanceMetres(
            "value",
            entry && entry.recordType === "distance" ? entry.value : null
          )}
          defaultUnit={fieldDefaultDistanceUnit("value")}
        />
      ) : (
        <NumberField
          key={recordType}
          name="value"
          step={valueStep}
          min={valueMin}
          required
          digitLimit={valueDigitLimit}
          allowDecimal={recordType === "weight"}
          initialValue={fieldDefault(
            "value",
            defaultValue !== undefined ? String(defaultValue) : undefined
          )}
          placeholder={`Value (${valueUnit})`}
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      )}

      <input
        type="date"
        name="achievedAt"
        defaultValue={fieldDefault("achievedAt", entry?.achievedAt ?? today)}
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
        {entry ? "Save" : "Add record"}
      </SubmitButton>
      <FormPendingBanner label="Saving…" />
    </form>
  );
}

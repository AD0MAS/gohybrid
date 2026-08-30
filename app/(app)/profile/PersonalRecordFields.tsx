"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { personalRecordTypeEnum, unitSystemEnum } from "@/db/schema";
import type { PersonalRecord } from "@/lib/personal-records";
import {
  formatPersonalRecordValue,
  resolveDistanceInputUnit,
  toDistanceInputValue,
} from "@/lib/units";
import Modal from "../_components/Modal";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import {
  addPersonalRecord,
  updatePersonalRecord,
  type PersonalRecordFormState,
} from "./personal-records-actions";

type PersonalRecordFieldsProps = {
  catalog: { id: string; name: string; isHyroxStation: boolean }[];
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  /** Absent renders the Add-record button + form; present renders a Pencil
   * edit trigger + the same form pre-filled from this entry, submitting to
   * updatePersonalRecord instead of addPersonalRecord. */
  entry?: PersonalRecord;
};

const initialState: PersonalRecordFormState = { status: "idle" };

/**
 * The whole add-record form as a client component — merges what were two
 * concerns (RecordTypeValueFields' record-type/value pair, and the
 * exercise/custom-name choice) into one, since both need client state and
 * useActionState itself requires a client component. Three things need
 * JS: (1) the value input's unit placeholder tracks the selected record
 * type AND, for distance, the selected exercise (a HYROX station always
 * shows metres — see resolveDistanceInputUnit in lib/units.ts, shared
 * with addPersonalRecord's actual conversion so the placeholder can never
 * promise a unit the server converts differently); (2) the exercise select
 * and the custom-name input are mutually exclusive — a single `<select>`
 * lists the catalog plus a "Custom…" option (value ""), and the
 * custom-name text input only renders when that option is selected. The
 * server (validatePersonalRecordInput) still rejects both/neither being
 * present — this UI just makes the common case impossible to get wrong.
 * useActionState renders the server's validation error above the submit
 * button instead of throwing into app/error.tsx, and keeps whatever the
 * user typed on failure since nothing unmounts. addPersonalRecord
 * (personal-records-actions.ts) does the actual imperial→metric
 * conversion server-side — this component only ever displays a unit,
 * never converts a value.
 *
 * The form itself lives inside a Modal, opened by the button rendered
 * alongside it: `open` is local state, closed only once addPersonalRecord's
 * state actually reaches "success" — an error leaves it open so the user
 * can fix and resubmit without retyping. That close is done during render
 * (comparing the state object's identity against prevState), not in a
 * useEffect, since setState in an effect just to react to another piece
 * of React state is the pattern React's own docs steer away from in
 * favour of adjusting state directly while rendering. The comparison uses
 * `state !== prevState` — object identity, not `state.status !==
 * prevStatus` — because addPersonalRecord returns a fresh object literal
 * on every call: comparing only the `.status` string would miss two
 * consecutive identical statuses (e.g. a second successful submission
 * right after the first), since "success" === "success" leaves the check
 * unable to tell "still the old result" from "a new result that happens
 * to match."
 *
 * When `entry` is present, this same component renders as
 * PersonalRecordsList's per-row edit trigger instead of the section's Add
 * button: a Pencil icon-button in place of the Plus button, "Edit
 * record"/"Save" copy, and every field's local state/defaultValue seeded
 * from `entry`. `updatePersonalRecord.bind(null, entry.id)` is used as the
 * form action in place of addPersonalRecord — the bound function still
 * matches useActionState's (prevState, formData) signature. The value
 * input's pre-fill must use the INPUT unit (what recordType/unitSystem
 * actually reads the resubmitted number as), not the display unit shown
 * on the list — those two disagree for distance (see toDistanceInputValue
 * in lib/units.ts): a weight pre-fills via formatPersonalRecordValue
 * (display and input agree — both are always lb under imperial), but a
 * distance pre-fills via toDistanceInputValue, since formatPersonalRecordValue
 * picks ft/mi per value while the input is always ft (or m for a HYROX
 * station) regardless of the stored value's size. Seeding a distance input
 * with the display value under its input-unit label would silently
 * corrupt it on save.
 */
export default function PersonalRecordFields({
  catalog,
  today,
  unitSystem,
  entry,
}: PersonalRecordFieldsProps) {
  const [open, setOpen] = useState(false);
  const action = entry
    ? updatePersonalRecord.bind(null, entry.id)
    : addPersonalRecord;
  const [state, formAction] = useActionState(action, initialState);
  const [exerciseId, setExerciseId] = useState(entry?.exerciseId ?? "");
  const [recordType, setRecordType] =
    useState<(typeof personalRecordTypeEnum.enumValues)[number]>(
      entry?.recordType ?? "weight"
    );
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setOpen(false);
  }

  const isHyroxStation =
    catalog.find((exercise) => exercise.id === exerciseId)?.isHyroxStation ??
    false;

  const unit =
    recordType === "distance"
      ? resolveDistanceInputUnit(unitSystem, isHyroxStation)
      : formatPersonalRecordValue(recordType, 0, unitSystem, isHyroxStation)
          .unit;

  const defaultValue = entry
    ? entry.recordType === "distance"
      ? toDistanceInputValue(entry.value, unitSystem, isHyroxStation)
      : formatPersonalRecordValue(
          entry.recordType,
          entry.value,
          unitSystem,
          isHyroxStation
        ).value
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
          Add record
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit record" : "Add record"}>
        <form action={formAction} className="flex flex-col gap-3">
          <select
            name="exerciseId"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <option value="">Custom…</option>
            {catalog.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>

          {exerciseId === "" && (
            <input
              type="text"
              name="customName"
              placeholder="Custom name"
              defaultValue={entry?.customName ?? ""}
              className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            />
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
            name="achievedAt"
            defaultValue={entry?.achievedAt ?? today}
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
            {entry ? "Save" : "Add record"}
          </button>
        </form>
      </Modal>
    </>
  );
}

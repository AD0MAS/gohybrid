"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { personalRecordTypeEnum, unitSystemEnum } from "@/db/schema";
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
 * JS: (1) the value input's placeholder tracks the selected record type
 * AND, for distance, the selected exercise (a HYROX station locks
 * DistanceInput to metres — see its own doc comment); (2) the exercise select
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
 * matches useActionState's (prevState, formData) signature. `entry.value` is
 * always metres already (the DB's own storage), so DistanceInput's
 * `defaultValueMetres` needs no conversion here — unlike the old
 * toDistanceInputValue approach it replaced, seeding a distance field is now
 * exactly as direct as seeding a weight one.
 *
 * A failed submit restores exactly what the user typed via the same
 * mechanism as GoalFields (see its doc comment for the full explanation):
 * `formKey` remounts the `<form>` on every error, which alone fixes the
 * controlled exerciseId/recordType selects (their state was never lost,
 * only their DOM); `fieldDefault`/`fieldDefaultSeconds`, reading
 * `addPersonalRecord`/`updatePersonalRecord`'s echoed `values`, restore the
 * plain uncontrolled fields (customName, achievedAt, notes) and the
 * value/DurationInput field that a remount alone would otherwise reset back
 * to `entry`'s original value. `fieldDefaultDistanceMetres`/
 * `fieldDefaultDistanceUnit` do the same for DistanceInput, but must restore
 * BOTH the number and the unit the user had selected — see their own doc
 * comment for why the unit can't just be re-derived from the recovered
 * metres value.
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
  const [formKey, setFormKey] = useState(0);
  if (state !== prevState) {
    setPrevState(state);
    if (state.status === "success") setOpen(false);
    else if (state.status === "error") setFormKey((key) => key + 1);
  }
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

  const isHyroxStation =
    catalog.find((exercise) => exercise.id === exerciseId)?.isHyroxStation ??
    false;

  const valueUnit = formatPersonalRecordValue(
    recordType,
    0,
    unitSystem,
    isHyroxStation
  ).unit;

  const defaultValue =
    entry && entry.recordType !== "distance"
      ? formatPersonalRecordValue(
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
        <form key={formKey} action={formAction} className="flex flex-col gap-3">
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
              defaultValue={fieldDefault("customName", entry?.customName ?? "")}
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

          {recordType === "time" ? (
            <DurationInput
              maxUnit="hours"
              name="value"
              defaultValueSeconds={fieldDefaultSeconds("value", defaultValue ?? null)}
            />
          ) : recordType === "distance" ? (
            <DistanceInput
              key={isHyroxStation ? "hyrox" : "standard"}
              name="value"
              unitSystem={unitSystem}
              isHyroxStation={isHyroxStation}
              defaultValueMetres={fieldDefaultDistanceMetres(
                "value",
                entry && entry.recordType === "distance" ? entry.value : null
              )}
              defaultUnit={fieldDefaultDistanceUnit("value")}
            />
          ) : (
            <input
              type="number"
              name="value"
              step="0.01"
              min="0"
              required
              defaultValue={fieldDefault(
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

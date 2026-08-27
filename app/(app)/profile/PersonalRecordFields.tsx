"use client";

import { useActionState, useState } from "react";
import { personalRecordTypeEnum, unitSystemEnum } from "@/db/schema";
import { formatPersonalRecordValue, resolveDistanceInputUnit } from "@/lib/units";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import {
  addPersonalRecord,
  type PersonalRecordFormState,
} from "./personal-records-actions";

type PersonalRecordFieldsProps = {
  catalog: { id: string; name: string; isHyroxStation: boolean }[];
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
};

const initialState: PersonalRecordFormState = { error: null };

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
 */
export default function PersonalRecordFields({
  catalog,
  today,
  unitSystem,
}: PersonalRecordFieldsProps) {
  const [state, formAction] = useActionState(addPersonalRecord, initialState);
  const [exerciseId, setExerciseId] = useState("");
  const [recordType, setRecordType] =
    useState<(typeof personalRecordTypeEnum.enumValues)[number]>("weight");

  const isHyroxStation =
    catalog.find((exercise) => exercise.id === exerciseId)?.isHyroxStation ??
    false;

  const unit =
    recordType === "distance"
      ? resolveDistanceInputUnit(unitSystem, isHyroxStation)
      : formatPersonalRecordValue(recordType, 0, unitSystem, isHyroxStation)
          .unit;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <select
        name="exerciseId"
        value={exerciseId}
        onChange={(e) => setExerciseId(e.target.value)}
        className="h-11 rounded border border-gray-300 px-4 text-base"
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
          className="h-11 rounded border border-gray-300 px-4 text-base"
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
        className="h-11 rounded border border-gray-300 px-4 text-base"
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
        placeholder={`Value (${unit})`}
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      <input
        type="date"
        name="achievedAt"
        defaultValue={today}
        max={today}
        required
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      <input
        type="text"
        name="notes"
        placeholder="Notes (optional)"
        className="h-11 rounded border border-gray-300 px-4 text-base"
      />

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button
        type="submit"
        className="flex h-11 items-center justify-center rounded bg-black px-4 text-base text-white"
      >
        Add record
      </button>
    </form>
  );
}

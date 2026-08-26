"use client";

import { useActionState, useState } from "react";
import { personalRecordTypeEnum } from "@/db/schema";
import { PERSONAL_RECORD_LABELS } from "./personal-record-labels";
import {
  addPersonalRecord,
  type PersonalRecordFormState,
} from "./personal-records-actions";

type PersonalRecordFieldsProps = {
  catalog: { id: string; name: string }[];
  today: string;
};

const initialState: PersonalRecordFormState = { error: null };

/**
 * The whole add-record form as a client component — merges what were two
 * concerns (RecordTypeValueFields' record-type/value pair, and the
 * exercise/custom-name choice) into one, since both need client state and
 * useActionState itself requires a client component. Two things need JS:
 * (1) the value input's unit placeholder tracks the selected record type;
 * (2) the exercise select and the custom-name input are mutually
 * exclusive — a single `<select>` lists the catalog plus a "Custom…"
 * option (value ""), and the custom-name text input only renders when that
 * option is selected. The server (validatePersonalRecordInput) still
 * rejects both/neither being present — this UI just makes the common case
 * impossible to get wrong. useActionState renders the server's validation
 * error above the submit button instead of throwing into app/error.tsx,
 * and keeps whatever the user typed on failure since nothing unmounts.
 */
export default function PersonalRecordFields({
  catalog,
  today,
}: PersonalRecordFieldsProps) {
  const [state, formAction] = useActionState(addPersonalRecord, initialState);
  const [exerciseId, setExerciseId] = useState("");
  const [recordType, setRecordType] =
    useState<(typeof personalRecordTypeEnum.enumValues)[number]>("weight");

  const { unit } = PERSONAL_RECORD_LABELS[recordType];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <select
        name="exerciseId"
        value={exerciseId}
        onChange={(e) => setExerciseId(e.target.value)}
        className="rounded border border-gray-300 p-2 text-sm"
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
          className="rounded border border-gray-300 p-2 text-sm"
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
        className="rounded border border-gray-300 p-2 text-sm"
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
        className="rounded border border-gray-300 p-2 text-sm"
      />

      <input
        type="date"
        name="achievedAt"
        defaultValue={today}
        max={today}
        required
        className="rounded border border-gray-300 p-2 text-sm"
      />

      <input
        type="text"
        name="notes"
        placeholder="Notes (optional)"
        className="rounded border border-gray-300 p-2 text-sm"
      />

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <button
        type="submit"
        className="rounded bg-black p-2 text-sm text-white"
      >
        Add record
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { bodyMetricTypeEnum } from "@/db/schema";
import { addBodyMetric, type BodyMetricFormState } from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";

type BodyMetricFieldsProps = { today: string };

const initialState: BodyMetricFormState = { error: null };

/**
 * The add-measurement form as a client component, needed for
 * useActionState: a validation failure from addBodyMetric renders here as
 * { error } above the submit button instead of throwing into
 * app/error.tsx, and the user's input stays put since nothing unmounts.
 */
export default function BodyMetricFields({ today }: BodyMetricFieldsProps) {
  const [state, formAction] = useActionState(addBodyMetric, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <select
        name="metricType"
        defaultValue="weight"
        className="rounded border border-gray-300 p-2 text-sm"
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
        placeholder="Value"
        className="rounded border border-gray-300 p-2 text-sm"
      />

      <input
        type="date"
        name="measuredAt"
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
        Add measurement
      </button>
    </form>
  );
}

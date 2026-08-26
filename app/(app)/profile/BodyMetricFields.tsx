"use client";

import { useActionState, useState } from "react";
import { bodyMetricTypeEnum, unitSystemEnum } from "@/db/schema";
import { formatBodyMetricValue } from "@/lib/units";
import { addBodyMetric, type BodyMetricFormState } from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";

type BodyMetricFieldsProps = {
  today: string;
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
};

const initialState: BodyMetricFormState = { error: null };

/**
 * The add-measurement form as a client component, needed for
 * useActionState: a validation failure from addBodyMetric renders here as
 * { error } above the submit button instead of throwing into
 * app/error.tsx. The value input's placeholder shows the unit the user is
 * actually expected to type in (e.g. "Value (lb)" under imperial) — via
 * formatBodyMetricValue(metricType, 0, unitSystem).unit; the dummy value 0
 * is safe here because weight/body_fat/resting_hr's unit never depends on
 * the value, only on unitSystem (unlike a distance PR's unit — see
 * PersonalRecordFields). The metric_type select needs local state (unlike
 * the old uncontrolled version) so the placeholder can react to it.
 * addBodyMetric (body-metrics-actions.ts) does the actual imperial→metric
 * conversion server-side — this component only ever displays a unit, never
 * converts a value.
 */
export default function BodyMetricFields({
  today,
  unitSystem,
}: BodyMetricFieldsProps) {
  const [state, formAction] = useActionState(addBodyMetric, initialState);
  const [metricType, setMetricType] =
    useState<(typeof bodyMetricTypeEnum.enumValues)[number]>("weight");

  const { unit } = formatBodyMetricValue(metricType, 0, unitSystem);

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
        placeholder={`Value (${unit})`}
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

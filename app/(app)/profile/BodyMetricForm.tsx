import { bodyMetricTypeEnum } from "@/db/schema";
import { getCurrentDateString } from "@/lib/scheduled-workouts";
import { addBodyMetric } from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";

/**
 * Add-measurement form for /profile's Body Metrics section: metric type,
 * value, date (defaults to today), optional notes. Plain form + Server
 * Action, no client JS — validation happens server-side in addBodyMetric
 * via the shared validateBodyMetricInput.
 */
export default async function BodyMetricForm() {
  const today = await getCurrentDateString();

  return (
    <form action={addBodyMetric} className="flex flex-col gap-3">
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

      <button
        type="submit"
        className="rounded bg-black p-2 text-sm text-white"
      >
        Add measurement
      </button>
    </form>
  );
}

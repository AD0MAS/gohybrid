import { bodyMetricTypeEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getBodyMetricsForUser } from "@/lib/body-metrics";
import { formatBodyMetricValue } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import { deleteBodyMetric } from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";

/**
 * Existing body metrics, grouped by metric type (weight, body fat,
 * resting HR — in that fixed enum order) and newest-measured first within
 * each group, with a delete action per row. Fetches its own data given
 * `userId` via requireUser(), same self-fetching convention as
 * WeekStrip/UpcomingList. getBodyMetricsForUser already returns rows
 * newest-measured-first, so grouping here doesn't need to re-sort. Each
 * entry's value is converted for display via formatBodyMetricValue and
 * the viewing user's unitSystem (getUserContext) — the stored value stays
 * kg/%/bpm regardless.
 */
export default async function BodyMetricsList() {
  const user = await requireUser();
  const [metrics, { unitSystem }] = await Promise.all([
    getBodyMetricsForUser(user.id),
    getUserContext(user.id),
  ]);

  if (metrics.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        No measurements yet. Add one above to start tracking.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bodyMetricTypeEnum.enumValues.map((type) => {
        const entries = metrics.filter((m) => m.metricType === type);
        if (entries.length === 0) return null;

        const { label } = BODY_METRIC_LABELS[type];

        return (
          <div key={type} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{label}</h3>
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => {
                const display = formatBodyMetricValue(
                  type,
                  entry.value,
                  unitSystem
                );
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded border border-gray-300 p-5"
                  >
                    <div>
                      <p className="text-sm">
                        {display.value} {display.unit} · {entry.measuredAt}
                      </p>
                      {entry.notes && (
                        <p className="text-sm text-gray-600">{entry.notes}</p>
                      )}
                    </div>
                    <form action={deleteBodyMetric.bind(null, entry.id)}>
                      <button
                        type="submit"
                        className="text-sm text-red-700 underline"
                      >
                        Delete
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

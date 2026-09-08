import { X } from "lucide-react";
import { SubmitButton } from "@/app/_components/FormStatus";
import { bodyMetricTypeEnum } from "@/db/schema";
import { getBodyMetricsForUser } from "@/lib/body-metrics";
import { formatBodyMetricValue } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import BodyMetricFields from "./BodyMetricFields";
import { deleteBodyMetric } from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";

type BodyMetricsListProps = {
  userId: string;
};

/**
 * Existing body metrics, grouped by metric type (weight, body fat,
 * resting HR — in that fixed enum order) and newest-measured first within
 * each group, with a delete action per row. `userId` arrives as a prop from
 * ProfilePage rather than a local requireUser() call — same pattern as
 * /stats. getBodyMetricsForUser already returns rows newest-measured-first,
 * so grouping here doesn't need to re-sort. Each entry's value is converted
 * for display via formatBodyMetricValue and the viewing user's unitSystem
 * (getUserContext) — the stored value stays kg/%/bpm regardless. Each row's
 * Edit trigger embeds a BodyMetricFields instance directly (entry={entry})
 * — same one-modal-per-row wiring as GoalsList/EventsList, since
 * BodyMetricFields already owns its own open/close state and
 * useActionState call. `today` is fetched here too (not just in
 * BodyMetricForm) so every row's embedded BodyMetricFields has the same
 * max-date bound on its measuredAt input as the create form.
 */
export default async function BodyMetricsList({ userId }: BodyMetricsListProps) {
  const [metrics, { today, unitSystem }] = await Promise.all([
    getBodyMetricsForUser(userId),
    getUserContext(userId),
  ]);

  if (metrics.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
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
                    className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-1 p-5"
                  >
                    <div>
                      <p className="text-sm">
                        {display.value} {display.unit} · {entry.measuredAt}
                      </p>
                      {entry.notes && (
                        <p className="text-sm text-ink-subtle">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <BodyMetricFields today={today} unitSystem={unitSystem} entry={entry} />
                      <form action={deleteBodyMetric.bind(null, entry.id)}>
                        <SubmitButton
                          ariaLabel="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger active:bg-surface-2 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </SubmitButton>
                      </form>
                    </div>
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

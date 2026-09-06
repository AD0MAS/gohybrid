import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import type { ProgressSeries } from "@/lib/progress";
import { getProgressSeriesForUser } from "@/lib/progress";
import { getUserContext } from "@/lib/user-settings";
import { BODY_METRIC_LABELS } from "../profile/body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "../profile/personal-record-labels";
import ActivityHeatmap from "./ActivityHeatmap";
import DistributionChart from "./DistributionChart";
import ProgressChart, { type LabeledProgressSeries } from "./ProgressChart";
import SummaryCards from "./SummaryCards";
import WeeklyChart from "./WeeklyChart";

export const metadata: Metadata = {
  title: "Stats",
};

/**
 * Attaches a series' display label — lib/progress.ts deliberately doesn't
 * (labels are UI copy, not lib/'s concern; see that file's own comment on
 * ProgressSeries). Resolved here, server-side, from the same
 * BODY_METRIC_LABELS/PERSONAL_RECORD_LABELS maps GoalFields/BodyMetricsList/
 * PersonalRecordFields already use, before ProgressChart — a client
 * component — ever sees the series, so the chart still only ever renders
 * data it's already been handed.
 */
function labelProgressSeries(series: ProgressSeries): LabeledProgressSeries {
  const label =
    series.kind === "body_metric"
      ? BODY_METRIC_LABELS[series.metricType].label
      : `${series.subjectLabel} (${PERSONAL_RECORD_LABELS[series.recordType].label})`;

  return { ...series, label };
}

/**
 * Layer 3's training analytics page: summary cards, the activity heatmap,
 * and the weekly volume / primary-type distribution charts — all sourced
 * from workout_sessions. Plus Layer 4's Progress Charts, sourced ONLY from
 * Personal Records/Body Metrics, never from sessions (see GOHYBRID_PLAN.md
 * §5 Layer 4 — avoids "fake analytics"). Will grow into the Dashboard's
 * analytics section; for now it's its own page.
 */
export default async function StatsPage() {
  const user = await requireUser();
  const { unitSystem } = await getUserContext(user.id);
  const progressSeries = await getProgressSeriesForUser(user.id, unitSystem);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-xl font-semibold">Stats</h1>

      <SummaryCards userId={user.id} />
      <ActivityHeatmap userId={user.id} />
      <WeeklyChart userId={user.id} />
      <DistributionChart userId={user.id} />
      <ProgressChart series={progressSeries.map(labelProgressSeries)} />
    </main>
  );
}

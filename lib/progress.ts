import { BODY_METRIC_LABELS } from "@/app/(app)/profile/body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "@/app/(app)/profile/personal-record-labels";
import {
  getPersonalRecordsForUser,
  groupPersonalRecordsBySubject,
} from "@/lib/personal-records";
import { getBodyMetricsForUser } from "@/lib/body-metrics";

export type ProgressPoint = {
  date: string;
  value: number;
};

export type ProgressSeries = {
  key: string;
  label: string;
  unit: string;
  points: ProgressPoint[];
};

/**
 * Assembles every chartable progress series for `userId`: one per
 * body_metric_type with data, plus one per personal-record subject+type
 * group with data (see GOHYBRID_PLAN.md §5 Layer 4 — progress charts are
 * sourced ONLY from Personal Records/Body Metrics, never from
 * workout_sessions, to avoid "fake analytics"). Grouping reuses
 * groupPersonalRecordsBySubject from lib/personal-records.ts rather than
 * regrouping records here, so subject/record_type identity has one
 * definition. Points are sorted oldest to newest, the opposite of the
 * newest-first lists elsewhere, since charts read left to right. A series
 * with fewer than 2 points is still returned — the UI decides how to
 * render a single point.
 */
export async function getProgressSeriesForUser(
  userId: string
): Promise<ProgressSeries[]> {
  const [records, metrics] = await Promise.all([
    getPersonalRecordsForUser(userId),
    getBodyMetricsForUser(userId),
  ]);

  const series: ProgressSeries[] = [];

  const metricsByType = new Map<string, ProgressPoint[]>();
  for (const metric of metrics) {
    const points = metricsByType.get(metric.metricType) ?? [];
    points.push({ date: metric.measuredAt, value: metric.value });
    metricsByType.set(metric.metricType, points);
  }
  for (const [metricType, points] of metricsByType) {
    const { label, unit } = BODY_METRIC_LABELS[
      metricType as keyof typeof BODY_METRIC_LABELS
    ];
    series.push({
      key: `metric:${metricType}`,
      label,
      unit,
      points: sortByDate(points),
    });
  }

  const groups = groupPersonalRecordsBySubject(records);
  for (const group of groups) {
    const { unit } = PERSONAL_RECORD_LABELS[group.recordType];
    series.push({
      key: `pr:${group.subjectKey}`,
      label: `${group.subjectLabel} (${PERSONAL_RECORD_LABELS[group.recordType].label})`,
      unit,
      points: sortByDate(
        group.history.map((record) => ({
          date: record.achievedAt,
          value: record.value,
        }))
      ),
    });
  }

  return series;
}

function sortByDate(points: ProgressPoint[]): ProgressPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

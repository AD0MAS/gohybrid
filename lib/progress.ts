import { BODY_METRIC_LABELS } from "@/app/(app)/profile/body-metric-labels";
import { PERSONAL_RECORD_LABELS } from "@/app/(app)/profile/personal-record-labels";
import type { unitSystemEnum } from "@/db/schema";
import {
  getPersonalRecordsForUser,
  groupPersonalRecordsBySubject,
} from "@/lib/personal-records";
import { getBodyMetricsForUser } from "@/lib/body-metrics";
import {
  formatBodyMetricValue,
  formatPersonalRecordValue,
  kgToLb,
  metresToFeet,
  metresToMiles,
} from "@/lib/units";

type UnitSystem = (typeof unitSystemEnum.enumValues)[number];

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

function roundForDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Converts one already-metric value into a fixed target `unit` (one of the
 * units formatWeightKg/formatDistanceMetres can produce) — the counterpart
 * to picking that unit once for a whole series in getProgressSeriesForUser
 * below, rather than letting formatPersonalRecordValue re-decide feet vs.
 * miles per point (see that function's comment for why a chart needs one
 * consistent unit for its Y axis).
 */
function convertToFixedUnit(value: number, unit: string): number {
  switch (unit) {
    case "lb":
      return roundForDisplay(kgToLb(value));
    case "ft":
      return roundForDisplay(metresToFeet(value));
    case "mi":
      return roundForDisplay(metresToMiles(value));
    default:
      // kg, m, %, bpm, reps, seconds — already the value to display.
      return roundForDisplay(value);
  }
}

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
 *
 * Every point's `value` is already converted to `unitSystem` here — never
 * in ProgressChart.tsx, a client component — so the chart only ever
 * renders numbers it's handed, same principle as every other read site in
 * this task. Weight and body-metric units are value-independent, so each
 * point converts independently via formatWeightKg/formatBodyMetricValue.
 * A distance personal-record series is the one exception: its display
 * rule (formatDistanceMetres) picks feet vs. miles per value, but a line
 * chart needs a single Y-axis unit for the whole series — so that unit is
 * resolved once, from the most recent point, and every point in the
 * series (including older ones that would, in isolation, pick a different
 * unit) is converted into that same one via convertToFixedUnit.
 */
export async function getProgressSeriesForUser(
  userId: string,
  unitSystem: UnitSystem
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
  for (const [metricType, rawPoints] of metricsByType) {
    const { label } = BODY_METRIC_LABELS[
      metricType as keyof typeof BODY_METRIC_LABELS
    ];
    const sorted = sortByDate(rawPoints);
    const formatted = sorted.map((p) => ({
      date: p.date,
      ...formatBodyMetricValue(
        metricType as Parameters<typeof formatBodyMetricValue>[0],
        p.value,
        unitSystem
      ),
    }));
    series.push({
      key: `metric:${metricType}`,
      label,
      unit: formatted[0]?.unit ?? "",
      points: formatted.map((p) => ({ date: p.date, value: p.value })),
    });
  }

  const groups = groupPersonalRecordsBySubject(records);
  for (const group of groups) {
    const isHyroxStation = group.best.exercise?.isHyroxStation ?? false;
    const rawPoints = sortByDate(
      group.history.map((record) => ({
        date: record.achievedAt,
        value: record.value,
      }))
    );

    let unit: string;
    let points: ProgressPoint[];

    if (group.recordType === "distance") {
      const reference = rawPoints[rawPoints.length - 1]?.value ?? 0;
      unit = formatPersonalRecordValue(
        "distance",
        reference,
        unitSystem,
        isHyroxStation
      ).unit;
      points = rawPoints.map((p) => ({
        date: p.date,
        value: convertToFixedUnit(p.value, unit),
      }));
    } else {
      const formatted = rawPoints.map((p) => ({
        date: p.date,
        ...formatPersonalRecordValue(
          group.recordType,
          p.value,
          unitSystem,
          isHyroxStation
        ),
      }));
      unit = formatted[0]?.unit ?? "";
      points = formatted.map((p) => ({ date: p.date, value: p.value }));
    }

    series.push({
      key: `pr:${group.subjectKey}`,
      label: `${group.subjectLabel} (${PERSONAL_RECORD_LABELS[group.recordType].label})`,
      unit,
      points,
    });
  }

  return series;
}

function sortByDate(points: ProgressPoint[]): ProgressPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

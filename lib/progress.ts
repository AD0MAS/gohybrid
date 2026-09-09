import type {
  bodyMetricTypeEnum,
  personalRecordTypeEnum,
  unitSystemEnum,
} from "@/db/schema";
import { getPersonalRecordsForUser } from "@/lib/personal-records";
import { groupPersonalRecordsBySubject } from "@/lib/personal-records-grouping";
import { getBodyMetricsForUser } from "@/lib/body-metrics";
import {
  formatBodyMetricValue,
  formatPersonalRecordValue,
  kgToLb,
  metresToFeet,
  metresToMiles,
} from "@/lib/units";

type UnitSystem = (typeof unitSystemEnum.enumValues)[number];
type BodyMetricType = (typeof bodyMetricTypeEnum.enumValues)[number];
type PersonalRecordType = (typeof personalRecordTypeEnum.enumValues)[number];

export type ProgressPoint = {
  date: string;
  value: number;
};

/**
 * A chartable series, identified by its raw subject rather than a display
 * label — labels are UI copy (BODY_METRIC_LABELS/PERSONAL_RECORD_LABELS,
 * both under app/(app)/profile/), and this is lib/, so attaching one is left
 * to the caller (see app/(app)/stats/page.tsx's labelProgressSeries). `kind`
 * discriminates which subject fields are present, mirroring the two loops
 * in getProgressSeriesForUser below.
 */
export type ProgressSeries = {
  key: string;
  unit: string;
  /** True only for a personal-record "time" series — its points are raw
   * seconds, which ProgressChart must render as durations (formatDurationSeconds)
   * rather than as a plain "<value> seconds" axis/tooltip. Carried
   * explicitly here rather than left for ProgressChart to infer from
   * `unit === "seconds"`, so that inference can't silently break if this
   * series' unit string ever changes for an unrelated reason. */
  isDuration: boolean;
  points: ProgressPoint[];
} & (
  | { kind: "body_metric"; metricType: BodyMetricType }
  | { kind: "personal_record"; subjectLabel: string; recordType: PersonalRecordType }
);

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
 * group with data (progress charts are sourced ONLY from Personal
 * Records/Body Metrics, never from workout_sessions, to avoid "fake
 * analytics"). Grouping reuses
 * groupPersonalRecordsBySubject from lib/personal-records-grouping.ts rather than
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

  const metricsByType = new Map<BodyMetricType, ProgressPoint[]>();
  for (const metric of metrics) {
    const points = metricsByType.get(metric.metricType) ?? [];
    points.push({ date: metric.measuredAt, value: metric.value });
    metricsByType.set(metric.metricType, points);
  }
  for (const [metricType, rawPoints] of metricsByType) {
    const sorted = sortByDate(rawPoints);
    const formatted = sorted.map((p) => ({
      date: p.date,
      ...formatBodyMetricValue(metricType, p.value, unitSystem),
    }));
    series.push({
      key: `metric:${metricType}`,
      kind: "body_metric",
      metricType,
      unit: formatted[0]?.unit ?? "",
      isDuration: false,
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
      kind: "personal_record",
      subjectLabel: group.subjectLabel,
      recordType: group.recordType,
      unit,
      isDuration: group.recordType === "time",
      points,
    });
  }

  return series;
}

function sortByDate(points: ProgressPoint[]): ProgressPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

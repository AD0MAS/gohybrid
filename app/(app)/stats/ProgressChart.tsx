"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayMonthShort } from "@/lib/dates";
import type { ProgressSeries } from "@/lib/progress";
import { formatDurationSeconds } from "@/lib/units";

/**
 * A ProgressSeries with its display label attached — lib/progress.ts
 * identifies a series by its raw subject only (metricType/recordType), never
 * a label (labels are UI copy, not lib/'s concern — see that file's own
 * comment); app/(app)/stats/page.tsx resolves the label via
 * BODY_METRIC_LABELS/PERSONAL_RECORD_LABELS before handing series to this
 * component, so the chart only ever renders data it's already been given,
 * same principle as every value on a series' points.
 */
export type LabeledProgressSeries = ProgressSeries & { label: string };

type ProgressChartProps = {
  series: LabeledProgressSeries[];
};

/** Whole-second tick steps for a duration series — a fractional step (e.g.
 * "12.5 seconds") isn't a value a person reads off an axis. */
const DURATION_STEPS = [15, 30, 60, 120, 300, 600, 900, 1800, 3600];

/**
 * A "nice" round step for an axis spanning `range`, aiming for ~4 gridlines
 * (Heckbert's nice-numbers algorithm applied to the step, same approach as
 * lib/charts.ts's buildAxisScale) — snapping the step to 1/2/5/10× a power of
 * ten is what keeps the Y axis free of floating-point noise, since every tick
 * is then an exact multiple of a round number instead of an arbitrary
 * fraction of the data's own min/max.
 */
function niceStep(range: number): number {
  const rough = range / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const factor =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return factor * magnitude;
}

/**
 * Snaps a raw step to the smallest whole-second increment in DURATION_STEPS
 * that's at least as large, falling back to the largest when the data's own
 * spread would need an even coarser one.
 */
function durationStep(rawStep: number): number {
  return (
    DURATION_STEPS.find((step) => step >= rawStep) ??
    DURATION_STEPS[DURATION_STEPS.length - 1]
  );
}

/**
 * Progress Charts: a Recharts LineChart over
 * whichever series a <select> picks, all data already fetched server-side
 * by the page — switching series re-renders from memory, no navigation and
 * no refetch. The only client component on /stats; a library is warranted
 * here (unlike WeeklyChart/DistributionChart/ActivityHeatmap) because of
 * the time axis and interactive tooltips. A series' points
 * always stay numeric (raw seconds for a duration series, e.g. a marathon
 * PR) — only the Y-axis ticks and the tooltip value read as a duration
 * (formatDurationSeconds), driven by `series.isDuration`, never the
 * underlying data Recharts plots.
 */
export default function ProgressChart({ series }: ProgressChartProps) {
  const [selectedKey, setSelectedKey] = useState(series[0]?.key ?? "");

  if (series.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-ink">Progress</h2>
        <p className="text-sm text-ink-subtle">
          No personal records or body metrics logged yet.
        </p>
      </section>
    );
  }

  const selected = series.find((s) => s.key === selectedKey) ?? series[0];

  const values = selected.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(Math.abs(max) * 0.1, 1);

  // Half a spread of padding on each side puts the data across roughly the
  // middle half of the plot: the direction is visible, but a small change
  // does not read as a collapse.
  const rawStep = niceStep(spread * 2);
  const step = selected.isDuration ? durationStep(rawStep) : rawStep;
  const lower = Math.max(0, Math.floor((min - spread * 0.5) / step) * step);
  const upper = Math.ceil((max + spread * 0.5) / step) * step;

  const ticks: number[] = [];
  for (let v = lower; v <= upper + step / 1000; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">Progress</h2>
        <select
          value={selected.key}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          {series.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {selected.points.length < 2 ? (
        <p className="text-sm text-ink-subtle">
          Only one data point for {selected.label} so far — log another to
          see a trend.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={selected.points}
              margin={{ top: 8, right: 8, bottom: 12, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) => formatDayMonthShort(date)}
                tickMargin={8}
                fontSize={11}
                stroke="var(--color-ink-subtle)"
              />
              <YAxis
                width={selected.isDuration ? 72 : 60}
                domain={[lower, upper]}
                ticks={ticks}
                fontSize={11}
                stroke="var(--color-ink-subtle)"
                tickFormatter={
                  selected.isDuration
                    ? (value: number) => formatDurationSeconds(value)
                    : undefined
                }
                label={
                  selected.isDuration
                    ? undefined
                    : {
                        value: selected.unit,
                        angle: -90,
                        position: "insideLeft",
                        offset: 12,
                        fontSize: 11,
                        fill: "var(--color-ink-subtle)",
                      }
                }
              />
              <Tooltip
                labelFormatter={(date) =>
                  typeof date === "string" ? formatDayMonthShort(date) : date
                }
                formatter={(value) =>
                  selected.isDuration
                    ? [formatDurationSeconds(Number(value)), selected.label]
                    : [`${value} ${selected.unit}`, selected.label]
                }
                contentStyle={{
                  backgroundColor: "var(--color-surface-3)",
                  border: "1px solid var(--color-hairline)",
                  borderRadius: 8,
                  color: "var(--color-ink)",
                }}
                labelStyle={{ color: "var(--color-ink-subtle)" }}
                itemStyle={{ color: "var(--color-ink)" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

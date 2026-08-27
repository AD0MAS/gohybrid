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

type ProgressChartProps = {
  series: ProgressSeries[];
};

/**
 * Progress Charts (GOHYBRID_PLAN.md §5 Layer 4): a Recharts LineChart over
 * whichever series a <select> picks, all data already fetched server-side
 * by the page — switching series re-renders from memory, no navigation and
 * no refetch. The only client component on /stats; a library is warranted
 * here (unlike WeeklyChart/DistributionChart/ActivityHeatmap) because of
 * the time axis and interactive tooltips (§5 Layer 3).
 */
export default function ProgressChart({ series }: ProgressChartProps) {
  const [selectedKey, setSelectedKey] = useState(series[0]?.key ?? "");

  if (series.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-700">Progress</h2>
        <p className="text-sm text-gray-600">
          No personal records or body metrics logged yet.
        </p>
      </section>
    );
  }

  const selected = series.find((s) => s.key === selectedKey) ?? series[0];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-700">Progress</h2>
        <select
          value={selected.key}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="h-11 rounded border border-gray-300 px-4 text-base"
        >
          {series.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {selected.points.length < 2 ? (
        <p className="text-sm text-gray-600">
          Only one data point for {selected.label} so far — log another to
          see a trend.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={selected.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string) => formatDayMonthShort(date)}
                fontSize={11}
                stroke="#6b7280"
              />
              <YAxis
                width={48}
                fontSize={11}
                stroke="#6b7280"
                label={{
                  value: selected.unit,
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                  fill: "#6b7280",
                }}
              />
              <Tooltip
                labelFormatter={(date) =>
                  typeof date === "string" ? formatDayMonthShort(date) : date
                }
                formatter={(value) => [`${value} ${selected.unit}`, selected.label]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#6b7280"
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

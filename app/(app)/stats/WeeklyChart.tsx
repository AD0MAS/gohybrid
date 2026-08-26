import { getWeeklySessionCountsForUser } from "@/lib/activity";
import { buildAxisScale } from "@/lib/charts";
import { formatDayMonthShort, getWeekStartsEndingAt } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";

type WeeklyChartProps = {
  userId: string;
};

/** Number of weeks the chart shows, oldest to newest. */
const WEEKS = 12;

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 200;
const MARGIN_LEFT = 28;
const MARGIN_RIGHT = 8;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 32;
const PLOT_WIDTH = VIEW_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PLOT_HEIGHT = VIEW_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
const PLOT_BOTTOM = MARGIN_TOP + PLOT_HEIGHT;

/**
 * Weekly volume chart: one vertical bar per week for the last 12 weeks,
 * hand-drawn SVG (no charting library — see GOHYBRID_PLAN.md §5 Layer 3).
 * Fetches its own data given `userId`, same convention as ActivityHeatmap.
 * Y axis is a "nice" rounded scale (see buildAxisScale) with a few
 * labelled gridlines; weeks with no sessions render as zero-height bars
 * rather than being omitted, so an all-zero range still shows a real
 * (non-degenerate) axis instead of dividing by zero.
 *
 * `viewBox`-scaled with no fixed pixel width/height, so the chart shrinks
 * with its container on narrow screens instead of overflowing. Both
 * "today" and the bucketing query's timezone come from getUserContext
 * (cached — see SummaryCards), so they're always the same user's calendar
 * day.
 */
export default async function WeeklyChart({ userId }: WeeklyChartProps) {
  const { today, timezone } = await getUserContext(userId);
  const weekStarts = getWeekStartsEndingAt(today, WEEKS);
  const counts = await getWeeklySessionCountsForUser(
    userId,
    weekStarts[0],
    today,
    timezone
  );
  const countByWeek = new Map(counts.map((c) => [c.weekStart, c.count]));
  const bars = weekStarts.map((weekStart) => ({
    weekStart,
    count: countByWeek.get(weekStart) ?? 0,
  }));

  const totalInRange = bars.reduce((sum, bar) => sum + bar.count, 0);
  const scale = buildAxisScale(Math.max(...bars.map((bar) => bar.count)));

  const slotWidth = PLOT_WIDTH / WEEKS;
  const barWidth = slotWidth * 0.6;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-gray-700">
        Weekly volume — last {WEEKS} weeks
      </h2>

      {totalInRange === 0 && (
        <p className="text-sm text-gray-600">
          No sessions in the last {WEEKS} weeks.
        </p>
      )}

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`${totalInRange} session${totalInRange === 1 ? "" : "s"} over the last ${WEEKS} weeks`}
      >
        {scale.gridlines.map((value) => {
          const y = PLOT_BOTTOM - (value / scale.max) * PLOT_HEIGHT;
          return (
            <g key={value}>
              <line
                x1={MARGIN_LEFT}
                x2={VIEW_WIDTH - MARGIN_RIGHT}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={MARGIN_LEFT - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="#6b7280"
              >
                {value}
              </text>
            </g>
          );
        })}

        {bars.map((bar, i) => {
          const barHeight = (bar.count / scale.max) * PLOT_HEIGHT;
          const x = MARGIN_LEFT + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = PLOT_BOTTOM - barHeight;

          return (
            <g key={bar.weekStart}>
              {barHeight > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  fill="#6b7280"
                />
              )}
              <title>
                Week of {formatDayMonthShort(bar.weekStart)} — {bar.count}{" "}
                session{bar.count === 1 ? "" : "s"}
              </title>
              <text
                x={x + barWidth / 2}
                y={PLOT_BOTTOM + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
              >
                {formatDayMonthShort(bar.weekStart)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

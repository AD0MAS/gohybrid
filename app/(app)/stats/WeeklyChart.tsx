import type { CSSProperties } from "react";
import { getWeeklySessionCountsForUser } from "@/lib/activity";
import { formatDayMonthShort, getWeekStartsEndingAt } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";

type WeeklyChartProps = {
  userId: string;
};

/** Number of weeks the chart shows, oldest to newest. */
const WEEKS = 6;

/**
 * Weekly volume chart: one vertical bar per week for the last 6 weeks,
 * built from plain HTML/CSS rather than a hand-drawn SVG — see
 * DistributionChart's comment for why. Fetches its own data given `userId`,
 * same convention as ActivityHeatmap. Weeks with no sessions render as a 4px
 * stub rather than a gap, so an empty week still reads as "the week exists
 * and is empty" instead of looking like a rendering gap.
 *
 * Bar height is expressed as a percentage of the plot's own (responsive)
 * height rather than a computed pixel value, since there's no client JS here
 * to know which breakpoint is active — the percentage is mathematically the
 * same fraction of the plot at either breakpoint, which is what a pixel
 * formula keyed to a fixed plot height would have computed anyway.
 *
 * Both "today" and the bucketing query's timezone come from getUserContext
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
  const avgPerWeek = (totalInRange / WEEKS).toFixed(1);

  const maxCount = Math.max(...bars.map((bar) => bar.count));
  const axisMax = Math.max(6, Math.ceil(maxCount / 6) * 6);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-sm font-medium text-ink">Weekly volume</h2>

        {totalInRange > 0 && (
          <p className="text-xs text-ink-tertiary">
            {totalInRange} session{totalInRange === 1 ? "" : "s"} · avg{" "}
            {avgPerWeek} / week · last {WEEKS} weeks
          </p>
        )}
      </div>

      {totalInRange === 0 && (
        <p className="text-sm text-ink-subtle">
          No sessions in the last {WEEKS} weeks.
        </p>
      )}

      <div className="flex gap-3 pt-6 sm:gap-5">
        <div className="relative h-[174px] w-3 shrink-0 text-right text-[11px] font-medium text-ink-tertiary sm:h-[216px] sm:w-3.5">
          <span className="absolute right-0 top-0 -translate-y-1/2">
            {axisMax}
          </span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2 sm:hidden">
            {axisMax / 2}
          </span>
          <span className="absolute right-0 top-[33.333%] hidden -translate-y-1/2 sm:block">
            {(axisMax * 2) / 3}
          </span>
          <span className="absolute right-0 top-[66.667%] hidden -translate-y-1/2 sm:block">
            {axisMax / 3}
          </span>
          <span className="absolute right-0 top-full -translate-y-1/2">
            0
          </span>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="relative h-[174px] sm:h-[216px]">
            <div className="absolute inset-x-0 top-0 h-px bg-hairline" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-hairline sm:hidden" />
            <div className="absolute inset-x-0 top-[33.333%] hidden h-px bg-hairline sm:block" />
            <div className="absolute inset-x-0 top-[66.667%] hidden h-px bg-hairline sm:block" />
            <div className="absolute inset-x-0 top-full h-px bg-hairline-strong" />

            <div className="absolute inset-0 grid grid-cols-6 gap-3 sm:gap-7">
              {bars.map((bar) => {
                const isZero = bar.count === 0;
                const barStyle: CSSProperties = isZero
                  ? { height: "4px" }
                  : {
                      height: `${(bar.count / axisMax) * 100}%`,
                      minHeight: "14px",
                    };

                return (
                  <div
                    key={bar.weekStart}
                    className="flex h-full flex-col items-center justify-end"
                  >
                    <div
                      className={`relative w-full max-w-[72px] rounded-t-[7px] rounded-b-[3px] sm:rounded-t-lg ${
                        isZero ? "bg-surface-4" : "bg-accent"
                      }`}
                      style={barStyle}
                    >
                      <span
                        className={`absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap text-xs font-semibold sm:mb-2 ${
                          isZero ? "text-ink-tertiary" : "text-accent-ink"
                        }`}
                      >
                        {bar.count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid h-[38px] grid-cols-6 place-items-center gap-3 whitespace-nowrap text-[11px] font-medium sm:h-11 sm:gap-7">
            {bars.map((bar) => {
              const isZero = bar.count === 0;
              return (
                <span
                  key={bar.weekStart}
                  className={
                    isZero ? "text-ink-tertiary" : "text-accent-ink-subtle"
                  }
                >
                  {formatDayMonthShort(bar.weekStart)}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

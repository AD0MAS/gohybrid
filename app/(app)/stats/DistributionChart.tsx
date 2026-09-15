import { workoutPrimaryTypeEnum } from "@/db/schema";
import { getSessionCountsByPrimaryTypeForUser } from "@/lib/activity";
import { getWeekStartsEndingAt } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";
import { PRIMARY_TYPE_LABELS } from "../workouts/primary-type-labels";

type DistributionChartProps = {
  userId: string;
};

/** Same window as WeeklyChart, so the two charts describe the same period. */
const WEEKS = 6;

/**
 * Whole-percent shares that sum to exactly 100 (given `total > 0`) via the
 * largest-remainder method: rounding each share independently
 * (Math.round(count / total * 100)) can overshoot 100, since two rows each
 * sitting at a .5 fraction both round up on their own. Flooring every share
 * first guarantees the sum is at or under 100, then the shortfall is handed
 * out one point at a time to the rows with the largest fractional remainder
 * — the ones closest to rounding up "for real" — breaking a tie by the
 * larger raw count.
 */
function computeShares(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return counts.map(() => 0);

  const exact = counts.map((count) => (count / total) * 100);
  const floors = exact.map(Math.floor);
  const shortfall = 100 - floors.reduce((sum, floor) => sum + floor, 0);

  const order = counts
    .map((count, index) => ({
      index,
      count,
      remainder: exact[index] - floors[index],
    }))
    .sort((a, b) => b.remainder - a.remainder || b.count - a.count);

  const shares = [...floors];
  for (let i = 0; i < shortfall; i++) {
    shares[order[i].index] += 1;
  }
  return shares;
}

/**
 * Primary-type distribution chart: one horizontal bar per
 * workout_primary_type, always — built from plain HTML/CSS rather than a
 * hand-drawn SVG. A fixed SVG viewBox scales its whole coordinate system —
 * label text included — down on a narrow screen until it's unreadable; with
 * real HTML the text no longer shrinks, and the counts become real text
 * nodes instead of <title> elements sitting inside a role="img" subtree
 * that assistive technology never reaches. The enum has no "hybrid" value
 * by design (the mix is described by tags, not a summary category), so
 * this never invents one; a user training only one discipline still sees
 * every row, the untrained ones at 0.
 *
 * The query only returns types with at least one session, so the missing
 * ones are zero-filled here against workoutPrimaryTypeEnum — the same
 * reasoning WeeklyChart zero-fills missing weeks against
 * getWeekStartsEndingAt. That removes the old empty-state message: with
 * every row always present, "no sessions" is a chart of five zeroed rows
 * rather than a special case to render instead of one. Rows sort largest
 * first, same as before; a tie — including every row sitting at zero — falls
 * back to the enum's own declared order (running, strength, hyrox,
 * conditioning, other) rather than an arbitrary one, since the array is
 * built in that order and Array#sort is stable.
 *
 * Fetches its own data given `userId`, same convention as ActivityHeatmap.
 * Both "today" and the bucketing query's timezone come from getUserContext
 * (cached — see SummaryCards), so they're always the same user's calendar
 * day.
 */
export default async function DistributionChart({
  userId,
}: DistributionChartProps) {
  const { today, timezone } = await getUserContext(userId);
  const weekStarts = getWeekStartsEndingAt(today, WEEKS);
  const sessionCounts = await getSessionCountsByPrimaryTypeForUser(
    userId,
    weekStarts[0],
    today,
    timezone
  );

  const countByType = new Map(
    sessionCounts.map((row) => [row.primaryType, row.count])
  );
  const rows = workoutPrimaryTypeEnum.enumValues
    .map((primaryType) => ({
      primaryType,
      count: countByType.get(primaryType) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const maxCount = rows[0].count;
  const shares = computeShares(rows.map((row) => row.count));

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-[15px] font-semibold leading-[1.2] text-ink">Training mix</h2>

        {total > 0 && (
          <p className="text-xs text-ink-tertiary">
            {total} session{total === 1 ? "" : "s"} · last {WEEKS} weeks
          </p>
        )}
      </div>

      {/* auto-rows-[38px]: a fixed row size, not 1fr — a flexible track
          would absorb the panel's whole leftover height into oversized
          bars. 38px is what this always-5-row grid (one row per enum value)
          produces when the panel is stretched to match WeeklyChart's
          height, with nothing left over to hand to content-around — that
          only mattered back when a shorter list of present-only types
          could leave rows unfilled. */}
      <div className="flex flex-1 flex-col gap-5 sm:grid sm:grid-cols-[max-content_1fr_max-content] sm:auto-rows-[38px] sm:gap-x-3 sm:gap-y-6">
        {rows.map((row, index) => {
          const barWidthPct = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
          const share = shares[index];
          const label = PRIMARY_TYPE_LABELS[row.primaryType].label;

          return (
            <div
              key={row.primaryType}
              className="flex flex-col gap-[9px] sm:contents"
            >
              <div className="flex items-baseline justify-between sm:hidden">
                <span className="text-[13px] font-medium text-ink-muted">
                  {label}
                </span>
                <div className="flex items-baseline gap-[7px]">
                  <span className="text-[13px] font-semibold text-ink">
                    {row.count}
                  </span>
                  <span className="text-[11px] text-ink-tertiary">
                    {share}%
                  </span>
                </div>
              </div>

              <span className="hidden text-[13px] font-medium text-ink-muted sm:block sm:self-center">
                {label}
              </span>

              <div className="h-[26px] w-full rounded-[9px] bg-surface-3 sm:h-full sm:rounded-[10px]">
                <div
                  className="h-full rounded-[9px] bg-accent sm:rounded-[10px]"
                  style={{ width: `${barWidthPct}%` }}
                />
              </div>

              <div className="hidden items-baseline gap-[7px] sm:flex sm:self-center">
                <span className="text-[13px] font-semibold text-ink">
                  {row.count}
                </span>
                <span className="text-[11px] text-ink-tertiary">
                  {share}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

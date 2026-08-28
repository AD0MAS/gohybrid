import { getSessionCountsByPrimaryTypeForUser } from "@/lib/activity";
import { getWeekStartsEndingAt } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";

type DistributionChartProps = {
  userId: string;
};

/** Same window as WeeklyChart, so the two charts describe the same period. */
const WEEKS = 12;

const VIEW_WIDTH = 640;
const ROW_HEIGHT = 28;
const BAR_HEIGHT = 14;
const MARGIN = 8;
const LABEL_WIDTH = 90;
const COUNT_LABEL_WIDTH = 32;
const BAR_MAX_WIDTH =
  VIEW_WIDTH - MARGIN * 2 - LABEL_WIDTH - COUNT_LABEL_WIDTH;

/**
 * Primary-type distribution chart: one horizontal bar per
 * workout_primary_type with at least one session in the last 12 weeks,
 * hand-drawn SVG. The enum has no "hybrid" value by design (the mix is
 * described by tags, not a summary category — see GOHYBRID_PLAN.md §5
 * Layer 3), so this never invents one; a user training only one discipline
 * simply sees one bar.
 *
 * Fetches its own data given `userId`, same convention as ActivityHeatmap.
 * `viewBox`-scaled with no fixed pixel width/height. Both "today" and the
 * bucketing query's timezone come from getUserContext (cached — see
 * SummaryCards), so they're always the same user's calendar day.
 */
export default async function DistributionChart({
  userId,
}: DistributionChartProps) {
  const { today, timezone } = await getUserContext(userId);
  const weekStarts = getWeekStartsEndingAt(today, WEEKS);
  const rows = await getSessionCountsByPrimaryTypeForUser(
    userId,
    weekStarts[0],
    today,
    timezone
  );

  const viewHeight = rows.length * ROW_HEIGHT + MARGIN * 2;
  const maxCount = rows.length > 0 ? rows[0].count : 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink">
        Training mix — last {WEEKS} weeks
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          No sessions in the last {WEEKS} weeks.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
          className="w-full"
          role="img"
          aria-label="Sessions by primary type, last 12 weeks"
        >
          {rows.map((row, i) => {
            const yCenter = MARGIN + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const barWidth =
              maxCount > 0 ? (row.count / maxCount) * BAR_MAX_WIDTH : 0;
            const barX = MARGIN + LABEL_WIDTH;

            return (
              <g key={row.primaryType}>
                <text
                  x={MARGIN}
                  y={yCenter + 4}
                  fontSize={11}
                  fill="var(--color-ink-muted)"
                >
                  {row.primaryType}
                </text>
                {barWidth > 0 && (
                  <rect
                    x={barX}
                    y={yCenter - BAR_HEIGHT / 2}
                    width={barWidth}
                    height={BAR_HEIGHT}
                    rx={2}
                    fill="var(--color-accent)"
                  />
                )}
                <text
                  x={barX + barWidth + 6}
                  y={yCenter + 4}
                  fontSize={11}
                  fill="var(--color-ink-muted)"
                >
                  {row.count}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

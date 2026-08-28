import { getDailySessionCountsForUser } from "@/lib/activity";
import { formatDayHeading, WEEKDAY_INITIALS } from "@/lib/dates";
import {
  buildHeatmapColumns,
  getHeatmapRange,
  type HeatmapColumn,
} from "@/lib/heatmap";
import { getUserContext } from "@/lib/user-settings";

type ActivityHeatmapProps = {
  userId: string;
};

/** Number of columns (weeks) shown on the mobile grid — the trailing six months. */
const MOBILE_WEEKS = 26;

/**
 * Shading step for a day's session count: 0 sessions, 1, 2, or 3+ — four
 * levels stepping from surface-1 up through accent (DESIGN.md tokens), so
 * more sessions reads as more lavender. SVG `fill` doesn't take Tailwind
 * classes, so the same scale is carried over as CSS variable references,
 * matching WeeklyChart/DistributionChart's convention.
 */
function fillForCount(count: number): string {
  if (count === 0) return "var(--color-surface-1)";
  if (count === 1) return "var(--color-heat-low)";
  if (count === 2) return "var(--color-heat-mid)";
  return "var(--color-accent)";
}

/** Total sessions across a set of columns, treating a null cell as 0. */
function sumSessions(columns: HeatmapColumn[]): number {
  return columns.reduce(
    (sum, column) =>
      sum + column.cells.reduce((s, cell) => s + (cell.count ?? 0), 0),
    0
  );
}

const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;
const LABEL_WIDTH = 20;
const MONTH_LABEL_HEIGHT = 16;
const GRID_HEIGHT = 7 * STEP - GAP;
const VIEW_HEIGHT = GRID_HEIGHT + MONTH_LABEL_HEIGHT;
/** Today's cell strokeWidth is 1.25 — half of that plus a small margin, so
 * the stroke isn't clipped by the viewBox when today falls in the last
 * column (see getHeatmapRange: `to` is always today, so today's cell is
 * always in the last column, never the first — no left-side margin needed). */
const TODAY_STROKE_MARGIN = 2;

type HeatmapGridProps = {
  columns: HeatmapColumn[];
  today: string;
  ariaLabel: string;
};

/**
 * One heatmap grid — weekday labels, cells, month labels — drawn from
 * whatever slice of columns it's given. Shared by both the desktop (full
 * year) and mobile (trailing six months) grids in ActivityHeatmap below, so
 * the markup exists once. `viewBox`-scaled with no fixed pixel width/height
 * (same convention as WeeklyChart/DistributionChart): CELL/GAP/STEP are
 * fixed only in the coordinate system columns are drawn in, and are shared
 * between both grids, so a wider (53-column) or narrower (26-column) grid
 * scales to its own container without changing the cell:gap proportions.
 */
function HeatmapGrid({ columns, today, ariaLabel }: HeatmapGridProps) {
  const viewWidth =
    LABEL_WIDTH + columns.length * STEP - GAP + TODAY_STROKE_MARGIN;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${VIEW_HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={ariaLabel}
    >
      {WEEKDAY_INITIALS.map((initial, row) => {
        const yCenter = row * STEP + CELL / 2;

        return (
          <text
            key={row}
            x={LABEL_WIDTH - 6}
            y={yCenter + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--color-ink-subtle)"
          >
            {initial}
          </text>
        );
      })}

      {columns.map((column, col) =>
        column.cells.map((cell, row) => {
          if (cell.count === null) return null;

          const x = LABEL_WIDTH + col * STEP;
          const y = row * STEP;
          const isToday = cell.date === today;

          return (
            <rect
              key={cell.date}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={2}
              fill={fillForCount(cell.count)}
              stroke={isToday ? "var(--color-accent)" : "none"}
              strokeWidth={isToday ? 1.25 : 0}
            >
              <title>
                {formatDayHeading(cell.date)} — {cell.count} session
                {cell.count === 1 ? "" : "s"}
              </title>
            </rect>
          );
        })
      )}

      {columns.map((column, col) => {
        if (!column.monthLabel) return null;

        return (
          <text
            key={column.monday}
            x={LABEL_WIDTH + col * STEP}
            y={GRID_HEIGHT + MONTH_LABEL_HEIGHT / 2 + 3}
            textAnchor="start"
            fontSize={9}
            fill="var(--color-ink-subtle)"
          >
            {column.monthLabel}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * GitHub-style activity heatmap (Roxfit-inspired): workout_sessions shaded
 * by day, one column per week (Monday first). Source is workout_sessions
 * only — see getDailySessionCountsForUser for the timezone-correct day
 * grouping. Fetches its own data given `userId`, same convention as
 * WeekStrip, so the page that renders it stays a plain Server Component
 * with no props plumbing beyond the user id. Both "today" and the
 * bucketing queries' timezone come from getUserContext (cached — see
 * SummaryCards), so they're always the same user's calendar day.
 *
 * One query fetches the full year (HEATMAP_WEEKS); two grids render from
 * the same `columns` array — desktop shows all of it, mobile shows only
 * the trailing MOBILE_WEEKS — so there's no second query and no client JS
 * to decide which to show (that's left to `hidden md:block` / `md:hidden`,
 * i.e. plain CSS media queries). The count line next to the heading swaps
 * the same way, so the number always matches the grid actually visible.
 */
export default async function ActivityHeatmap({
  userId,
}: ActivityHeatmapProps) {
  const { today, timezone } = await getUserContext(userId);
  const { from, to } = getHeatmapRange(today);
  const counts = await getDailySessionCountsForUser(userId, from, to, timezone);
  const columns = buildHeatmapColumns(from, to, counts);
  const mobileColumns = columns.slice(-MOBILE_WEEKS);

  const yearTotal = sumSessions(columns);
  const mobileTotal = sumSessions(mobileColumns);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-ink">Activity</h2>
        <p className="text-sm text-ink-subtle">
          <span className="hidden md:inline">
            {yearTotal} session{yearTotal === 1 ? "" : "s"} in the last year
          </span>
          <span className="md:hidden">
            {mobileTotal} session{mobileTotal === 1 ? "" : "s"} in the last
            six months
          </span>
        </p>
      </div>

      <div className="hidden md:block">
        <HeatmapGrid
          columns={columns}
          today={today}
          ariaLabel={`${yearTotal} session${yearTotal === 1 ? "" : "s"} in the last year`}
        />
      </div>
      <div className="md:hidden">
        <HeatmapGrid
          columns={mobileColumns}
          today={today}
          ariaLabel={`${mobileTotal} session${mobileTotal === 1 ? "" : "s"} in the last six months`}
        />
      </div>
    </section>
  );
}

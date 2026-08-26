import { getDailySessionCountsForUser } from "@/lib/activity";
import { formatDayHeading, WEEKDAY_INITIALS } from "@/lib/dates";
import { buildHeatmapColumns, getHeatmapRange } from "@/lib/heatmap";
import { getUserContext } from "@/lib/user-settings";

type ActivityHeatmapProps = {
  userId: string;
};

/**
 * Shading step for a day's session count: 0 sessions, 1, 2, or 3+ — four
 * levels, plain grays until the final UI pass picks a real palette.
 */
function shadeClassForCount(count: number): string {
  if (count === 0) return "bg-gray-100";
  if (count === 1) return "bg-gray-300";
  if (count === 2) return "bg-gray-500";
  return "bg-gray-700";
}

/**
 * GitHub-style activity heatmap (Roxfit-inspired): the last ~six months of
 * workout_sessions, one column per week (Monday first), shaded by how many
 * sessions completed that calendar day. Source is workout_sessions only —
 * see getDailySessionCountsForUser for the timezone-correct day grouping.
 * Fetches its own data given `userId`, same convention as WeekStrip, so the
 * page that renders it stays a plain Server Component with no props
 * plumbing beyond the user id. Both "today" and the bucketing queries'
 * timezone come from getUserContext (cached — see SummaryCards), so they're
 * always the same user's calendar day.
 */
export default async function ActivityHeatmap({
  userId,
}: ActivityHeatmapProps) {
  const { today, timezone } = await getUserContext(userId);
  const { from, to } = getHeatmapRange(today);
  const counts = await getDailySessionCountsForUser(userId, from, to, timezone);
  const columns = buildHeatmapColumns(from, to, counts);
  const totalSessions = counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        {totalSessions} session{totalSessions === 1 ? "" : "s"} in the last
        six months
      </p>

      <div className="flex gap-1 overflow-x-auto pb-2">
        <div className="flex flex-col gap-1">
          <span className="h-3 text-[10px] leading-3 text-gray-500" />
          {WEEKDAY_INITIALS.map((initial, i) => (
            <span
              key={i}
              className="flex h-3 w-3 items-center text-[10px] leading-3 text-gray-500"
            >
              {initial}
            </span>
          ))}
        </div>

        {columns.map((column) => (
          <div key={column.monday} className="flex flex-col gap-1">
            <span className="h-3 text-[10px] leading-3 whitespace-nowrap text-gray-500">
              {column.monthLabel ?? ""}
            </span>

            {column.cells.map((cell) => {
              if (cell.count === null) {
                return <span key={cell.date} className="h-3 w-3" />;
              }

              const isToday = cell.date === today;

              return (
                <span
                  key={cell.date}
                  title={`${formatDayHeading(cell.date)} — ${cell.count} session${
                    cell.count === 1 ? "" : "s"
                  }`}
                  className={`h-3 w-3 rounded-sm ${shadeClassForCount(cell.count)} ${
                    isToday ? "ring-1 ring-black ring-offset-1" : ""
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

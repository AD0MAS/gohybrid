import {
  getSessionCountForUserInRange,
  getStreaksForUser,
  getTotalSessionCountForUser,
} from "@/lib/activity";
import { getFirstDayOfMonth, getMondayOfWeek, getMonthString } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";
import SummaryCard from "../_components/SummaryCard";

type SummaryCardsProps = {
  userId: string;
};

/**
 * /stats summary row: total sessions, sessions this week, sessions this
 * month, current streak, longest streak. Fetches its own data given
 * `userId`, same convention as ActivityHeatmap/WeekStrip. "This week" and
 * "this month" reuse getSessionCountForUserInRange over the current
 * calendar week/month rather than the 12-week/12-month chart windows
 * below, so this card stays correct on its own even if those windows
 * change. Both "today" and the day-bucketing queries' timezone come from
 * getUserContext (cached, so this and the three chart components below
 * share one pair of queries per request), so they're always the same
 * user's calendar day.
 *
 * Below lg, the five cards lay out as two rows (3 + 2) on a 6-column
 * grid — each card spans 2 or 3 of those columns so both rows fill the
 * full width whenever all five don't fit on one row (phones through
 * iPad Air), and SummaryCard's compact variant keeps the mobile row
 * short enough that the heatmap below no longer needs a scroll to reach.
 * Only at lg, where all five cards fit on one row, does grid-cols-5 take
 * over, paired with an lg:col-span-1 reset on each wrapper so the
 * mobileSpan values stop applying at that same breakpoint.
 */
export default async function SummaryCards({ userId }: SummaryCardsProps) {
  const { today, timezone } = await getUserContext(userId);
  const weekStart = getMondayOfWeek(today);
  const monthStart = getFirstDayOfMonth(getMonthString(today));

  const [total, thisWeek, thisMonth, streaks] = await Promise.all([
    getTotalSessionCountForUser(userId),
    getSessionCountForUserInRange(userId, weekStart, today, timezone),
    getSessionCountForUserInRange(userId, monthStart, today, timezone),
    getStreaksForUser(userId, today, timezone),
  ]);

  const cards = [
    { label: "Total sessions", value: total, mobileSpan: "col-span-2" },
    { label: "This week", value: thisWeek, mobileSpan: "col-span-2" },
    { label: "This month", value: thisMonth, mobileSpan: "col-span-2" },
    { label: "Current streak", value: streaks.current, mobileSpan: "col-span-3" },
    { label: "Longest streak", value: streaks.longest, mobileSpan: "col-span-3" },
  ];

  return (
    <section className="grid grid-cols-6 gap-3 sm:gap-5 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className={`${card.mobileSpan} lg:col-span-1`}>
          <SummaryCard label={card.label} value={card.value} variant="compact" />
        </div>
      ))}
    </section>
  );
}

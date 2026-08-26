import {
  getSessionCountForUserInRange,
  getStreaksForUser,
  getTotalSessionCountForUser,
} from "@/lib/activity";
import { getFirstDayOfMonth, getMondayOfWeek, getMonthString } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";
import SummaryCard from "./SummaryCard";

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
    { label: "Total sessions", value: total },
    { label: "This week", value: thisWeek },
    { label: "This month", value: thisMonth },
    { label: "Current streak", value: streaks.current },
    { label: "Longest streak", value: streaks.longest },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cards.map((card) => (
        <SummaryCard key={card.label} label={card.label} value={card.value} />
      ))}
    </section>
  );
}

import {
  getSessionCountForUserInRange,
  getStreaksForUser,
  getTotalSessionCountForUser,
} from "@/lib/activity";
import { getFirstDayOfMonth, getMondayOfWeek, getMonthString } from "@/lib/dates";
import { getCurrentDateString } from "@/lib/scheduled-workouts";

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
 * change.
 */
export default async function SummaryCards({ userId }: SummaryCardsProps) {
  const today = await getCurrentDateString();
  const weekStart = getMondayOfWeek(today);
  const monthStart = getFirstDayOfMonth(getMonthString(today));

  const [total, thisWeek, thisMonth, streaks] = await Promise.all([
    getTotalSessionCountForUser(userId),
    getSessionCountForUserInRange(userId, weekStart, today),
    getSessionCountForUserInRange(userId, monthStart, today),
    getStreaksForUser(userId, today),
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
        <div key={card.label} className="rounded border border-gray-300 p-3">
          <p className="text-2xl font-semibold">{card.value}</p>
          <p className="text-xs text-gray-600">{card.label}</p>
        </div>
      ))}
    </section>
  );
}

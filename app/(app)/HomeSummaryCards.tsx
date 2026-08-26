import {
  getSessionCountForUserInRange,
  getStreaksForUser,
} from "@/lib/activity";
import { getFirstDayOfMonth, getMondayOfWeek, getMonthString } from "@/lib/dates";
import { getUserContext } from "@/lib/user-settings";
import SummaryCard from "./stats/SummaryCard";

type HomeSummaryCardsProps = {
  userId: string;
};

/**
 * Home's at-a-glance row (GOHYBRID_PLAN.md §5A): this week, this month,
 * current streak. A deliberate subset-and-duplicate of /stats' five-card
 * SummaryCards, reusing the exact same lib/ functions and the shared
 * SummaryCard tile — total sessions and longest streak stay /stats-only.
 * Fetches its own data given `userId`, same convention as
 * WeekStrip/UpcomingList. Both "today" and the day-bucketing queries'
 * timezone come from getUserContext, so they're always the same user's
 * calendar day (never Postgres's UTC `current_date` alongside a per-user
 * timezone, which would put "today" and the AT TIME ZONE buckets in two
 * different frames).
 */
export default async function HomeSummaryCards({
  userId,
}: HomeSummaryCardsProps) {
  const { today, timezone } = await getUserContext(userId);
  const weekStart = getMondayOfWeek(today);
  const monthStart = getFirstDayOfMonth(getMonthString(today));

  const [thisWeek, thisMonth, streaks] = await Promise.all([
    getSessionCountForUserInRange(userId, weekStart, today, timezone),
    getSessionCountForUserInRange(userId, monthStart, today, timezone),
    getStreaksForUser(userId, today, timezone),
  ]);

  const cards = [
    { label: "This week", value: thisWeek },
    { label: "This month", value: thisMonth },
    { label: "Current streak", value: streaks.current },
  ];

  return (
    <section className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <SummaryCard key={card.label} label={card.label} value={card.value} />
      ))}
    </section>
  );
}

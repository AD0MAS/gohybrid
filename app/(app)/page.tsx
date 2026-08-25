import { requireUser } from "@/lib/auth";
import HomeSummaryCards from "./HomeSummaryCards";
import RecentActivity from "./RecentActivity";
import UpcomingList from "./UpcomingList";

const UPCOMING_LIMIT = 3;

/**
 * Home: the at-a-glance state (GOHYBRID_PLAN.md §5A) — summary cards, then
 * Upcoming, then recent activity. The week strip moved to /workouts, which
 * is what it's primarily for; the nav shell covers navigation to the other
 * top-level pages, so this page holds only what's specific to it.
 */
export default async function Home() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Home</h1>

      <HomeSummaryCards userId={user.id} />
      <UpcomingList limit={UPCOMING_LIMIT} />
      <RecentActivity />
    </main>
  );
}

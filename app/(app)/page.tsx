import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import HomeSummaryCards from "./HomeSummaryCards";
import RecentActivity from "./RecentActivity";
import UpcomingList from "./UpcomingList";
import WeekStrip from "./WeekStrip";

export const metadata: Metadata = {
  title: "Home",
};

const UPCOMING_LIMIT = 3;

/**
 * Home: the at-a-glance state — summary cards, the week strip (moved here
 * from the old /workouts planning page, which is now the workout library),
 * then Upcoming, then recent activity. The nav shell covers navigation to
 * the other top-level pages, so this page holds only what's specific to it.
 */
export default async function Home(props: PageProps<"/">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-xl font-semibold">Home</h1>

      <HomeSummaryCards userId={user.id} />
      <WeekStrip userId={user.id} searchParams={searchParams} />
      <UpcomingList userId={user.id} limit={UPCOMING_LIMIT} />
      <RecentActivity userId={user.id} />
    </main>
  );
}

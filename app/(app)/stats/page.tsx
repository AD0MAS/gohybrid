import { requireUser } from "@/lib/auth";
import { getProgressSeriesForUser } from "@/lib/progress";
import { getUserContext } from "@/lib/user-settings";
import ActivityHeatmap from "./ActivityHeatmap";
import DistributionChart from "./DistributionChart";
import ProgressChart from "./ProgressChart";
import SummaryCards from "./SummaryCards";
import WeeklyChart from "./WeeklyChart";

/**
 * Layer 3's training analytics page: summary cards, the activity heatmap,
 * and the weekly volume / primary-type distribution charts — all sourced
 * from workout_sessions. Plus Layer 4's Progress Charts, sourced ONLY from
 * Personal Records/Body Metrics, never from sessions (see GOHYBRID_PLAN.md
 * §5 Layer 4 — avoids "fake analytics"). Will grow into the Dashboard's
 * analytics section; for now it's its own page.
 */
export default async function StatsPage() {
  const user = await requireUser();
  const { unitSystem } = await getUserContext(user.id);
  const progressSeries = await getProgressSeriesForUser(user.id, unitSystem);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Stats</h1>

      <SummaryCards userId={user.id} />
      <ActivityHeatmap userId={user.id} />
      <WeeklyChart userId={user.id} />
      <DistributionChart userId={user.id} />
      <ProgressChart series={progressSeries} />
    </main>
  );
}

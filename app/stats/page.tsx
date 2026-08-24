import Link from "next/link";
import { requireUser } from "@/lib/auth";
import ActivityHeatmap from "./ActivityHeatmap";
import DistributionChart from "./DistributionChart";
import SummaryCards from "./SummaryCards";
import WeeklyChart from "./WeeklyChart";

/**
 * Layer 3's training analytics page: summary cards, the activity heatmap,
 * and the weekly volume / primary-type distribution charts. Source is
 * workout_sessions only (see GOHYBRID_PLAN.md §5 Layer 3 — progress charts
 * proper are a separate, later feature sourced from Personal
 * Records/Body Metrics, never from sessions). Will grow into the
 * Dashboard's analytics section; for now it's its own page.
 */
export default async function StatsPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm underline">
          Home
        </Link>
        <h1 className="text-xl font-semibold">Stats</h1>
      </div>

      <SummaryCards userId={user.id} />
      <ActivityHeatmap userId={user.id} />
      <WeeklyChart userId={user.id} />
      <DistributionChart userId={user.id} />
    </main>
  );
}

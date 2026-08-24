import Link from "next/link";
import { requireUser } from "@/lib/auth";
import ActivityHeatmap from "./ActivityHeatmap";

/**
 * Layer 3's first slice: training analytics, starting with the activity
 * heatmap. Will grow into the Dashboard's analytics section; for now it's
 * its own page so the heatmap is genuinely visible and testable on its own.
 */
export default async function StatsPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm underline">
          Home
        </Link>
        <h1 className="text-xl font-semibold">Stats</h1>
      </div>

      <ActivityHeatmap userId={user.id} />
    </main>
  );
}

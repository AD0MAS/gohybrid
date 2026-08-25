import Link from "next/link";
import { requireUser } from "@/lib/auth";
import UpcomingList from "../UpcomingList";
import WeekStrip from "./WeekStrip";

const UPCOMING_LIMIT = 5;

/**
 * Workouts (GOHYBRID_PLAN.md §5A): the planning page shell — the week
 * strip up top (what this page is primarily for), then a prominent New
 * workout action, an entry into the library at /workouts/library, and
 * Upcoming. Deliberately not the library itself, since the strip, the
 * library, filters, sorting and secondary actions on one page was too
 * much for one screen. A Calendar corner button leads to /calendar.
 */
export default async function WorkoutsPage(props: PageProps<"/workouts">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workouts</h1>
        <Link
          href="/calendar"
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        >
          Calendar
        </Link>
      </div>

      <WeekStrip userId={user.id} searchParams={searchParams} />

      <Link
        href="/workouts/new"
        className="rounded bg-black p-3 text-center text-sm text-white"
      >
        New workout
      </Link>

      <Link
        href="/workouts/library"
        className="rounded border border-gray-300 p-3 text-center text-sm"
      >
        My Workouts
      </Link>

      <UpcomingList limit={UPCOMING_LIMIT} />
    </main>
  );
}

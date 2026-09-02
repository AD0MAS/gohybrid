import Link from "next/link";
import { requireUser } from "@/lib/auth";
import WeekStrip from "./WeekStrip";

/**
 * Workouts (GOHYBRID_PLAN.md §5A): the planning page shell — the week
 * strip up top (what this page is primarily for), then a prominent New
 * workout action and an entry into the library at /workouts/library.
 * Deliberately not the library itself, since the strip, the library,
 * filters, sorting and secondary actions on one page was too much for one
 * screen. A Calendar corner button leads to /calendar.
 *
 * No longer renders UpcomingList: the week strip's own day cards now carry
 * Mark done / Mark skipped / Remove (see WeekStrip's doc comment), which
 * made a second, future-only list of the same actions on this page
 * redundant. Home keeps its own UpcomingList unchanged — that's still the
 * only place those three entries render as a flat, cross-day list.
 */
export default async function WorkoutsPage(props: PageProps<"/workouts">) {
  const user = await requireUser();
  const searchParams = await props.searchParams;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">Workouts</h1>
          <Link
            href="/calendar"
            className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Calendar
          </Link>
        </div>

        <WeekStrip userId={user.id} searchParams={searchParams} />

        <Link
          href="/workouts/new"
          className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          New workout
        </Link>

        <Link
          href="/workouts/library"
          className="flex h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          My Workouts
        </Link>
      </div>
    </main>
  );
}

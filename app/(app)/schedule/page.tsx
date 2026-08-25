import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUpcomingForUser } from "@/lib/scheduled-workouts";
import { TAG_COLOR_CLASSES } from "../workouts/tag-colors";
import { markScheduledWorkoutSkipped, unscheduleWorkout } from "./actions";

const UPCOMING_LIMIT = 50;

/**
 * Upcoming scheduled workouts: soonest first, each with its workout's
 * title, tags, and controls to mark it skipped or remove it entirely.
 * Reads via getUpcomingForUser, which already excludes skipped entries and
 * ones that already have a linked session — everything rendered here is
 * still a genuinely open plan. Queries the database directly via
 * lib/scheduled-workouts rather than fetching an API route — same
 * reasoning as the /workouts list and detail pages.
 */
export default async function SchedulePage() {
  const user = await requireUser();
  const upcoming = await getUpcomingForUser(user.id, UPCOMING_LIMIT);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Upcoming</h1>

      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-600">
          Nothing scheduled yet. Schedule a workout from its detail page.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.map((entry) => (
            <li key={entry.id} className="rounded border border-gray-300 p-3">
              <Link
                href={`/workouts/${entry.workout.id}`}
                className="font-medium underline"
              >
                {entry.workout.title}
              </Link>
              <p className="text-sm text-gray-600">{entry.scheduledDate}</p>
              {entry.notes && (
                <p className="text-sm text-gray-600">Notes: {entry.notes}</p>
              )}

              {entry.workout.workoutTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.workout.workoutTags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className={`rounded-full border px-3 py-1 text-xs ${TAG_COLOR_CLASSES[tag.color]}`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 flex gap-4">
                <form
                  action={markScheduledWorkoutSkipped.bind(null, entry.id, true)}
                >
                  <button type="submit" className="text-sm underline">
                    Mark skipped
                  </button>
                </form>
                <form action={unscheduleWorkout.bind(null, entry.id)}>
                  <button
                    type="submit"
                    className="text-sm text-red-700 underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

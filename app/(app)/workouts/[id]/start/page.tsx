import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserContext } from "@/lib/user-settings";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";
import StartWorkoutClient from "./StartWorkoutClient";

/**
 * Start Workout Mode: a focused page showing the workout's blocks and
 * items in order, each item checkable, for following along during a
 * session. 404s under the same conditions as the detail page: missing id,
 * malformed id, or a workout owned by a different user.
 *
 * Stays a Server Component that only fetches the workout — the checkable
 * list, and its localStorage-backed progress, lives entirely in the
 * StartWorkoutClient boundary below, since none of that state has any
 * reason to touch the server (see GOHYBRID_PLAN.md §7, Session stores no
 * performance data).
 */
export default async function StartWorkoutPage(
  props: PageProps<"/workouts/[id]/start">
) {
  const { id } = await props.params;
  const user = await requireUser();

  if (!isValidUuid(id)) {
    notFound();
  }

  const [workout, { unitSystem }] = await Promise.all([
    getWorkoutForUser(id, user.id),
    getUserContext(user.id),
  ]);

  if (!workout) {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <Link
          href={`/workouts/${workout.id}`}
          className="text-sm text-ink-subtle underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Back to workout
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-ink">{workout.title}</h1>
          <p className="text-sm text-ink-subtle">
            {[
              workout.primaryType,
              workout.difficulty,
              workout.estimatedDurationMinutes != null &&
                `${workout.estimatedDurationMinutes} min`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <StartWorkoutClient workout={workout} unitSystem={unitSystem} />
      </div>
    </main>
  );
}

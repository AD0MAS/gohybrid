import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getWorkoutsForUser } from "@/lib/workouts";

/**
 * Lists the authenticated user's workouts: title, primary type, difficulty.
 * Queries the database directly via lib/workouts instead of fetching
 * /api/workouts over HTTP — this is a Server Component running in the same
 * process as the database access layer, so a self-fetch would only add a
 * network round trip and a duplicate auth check for no benefit. The API
 * route stays in place as the surface for later client-side use (e.g. a
 * client-rendered filter/search UI).
 */
export default async function WorkoutsPage() {
  const user = await requireUser();
  const userWorkouts = await getWorkoutsForUser(user.id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Workouts</h1>

      <Link href="/workouts/new" className="text-sm underline">
        New workout
      </Link>

      {userWorkouts.length === 0 ? (
        <p className="text-sm text-gray-600">No workouts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {userWorkouts.map((workout) => (
            <li
              key={workout.id}
              className="rounded border border-gray-300 p-3"
            >
              <Link href={`/workouts/${workout.id}`} className="underline">
                {workout.title}
              </Link>
              <p className="text-sm text-gray-600">
                {workout.primaryType} · {workout.difficulty}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

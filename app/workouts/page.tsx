import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { workouts } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/**
 * Lists the authenticated user's workouts: title, primary type, difficulty.
 * Queries the database directly with Drizzle instead of fetching
 * /api/workouts over HTTP — this is a Server Component running in the same
 * process as the database access layer, so a self-fetch would only add a
 * network round trip and a duplicate auth check for no benefit. The API
 * route stays in place as the surface for later client-side use (e.g. a
 * client-rendered filter/search UI).
 *
 * Since RLS is disabled, the explicit `eq(workouts.userId, user.id)`
 * filter is the only thing preventing cross-user data access here.
 */
export default async function WorkoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, user.id))
    .orderBy(desc(workouts.createdAt));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Workouts</h1>

      {userWorkouts.length === 0 ? (
        <p className="text-sm text-gray-600">No workouts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {userWorkouts.map((workout) => (
            <li
              key={workout.id}
              className="rounded border border-gray-300 p-3"
            >
              <p className="font-medium">{workout.title}</p>
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

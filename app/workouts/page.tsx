import Link from "next/link";
import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getTagCatalog } from "@/lib/tags";
import { getWorkoutsForUser } from "@/lib/workouts";
import { parseWorkoutListSearchParams } from "@/lib/workouts-filters";
import { toggleFavorite } from "./actions";
import FavoriteToggle from "./FavoriteToggle";
import { TAG_COLOR_CLASSES } from "./tag-colors";
import WorkoutFilters from "./WorkoutFilters";

/**
 * Lists the authenticated user's workouts: title, primary type, difficulty,
 * filtered by whichever of q/primaryType/difficulty/tags/favorites are
 * present in the URL (see parseWorkoutListSearchParams). The URL is the
 * source of truth for the filter state — not client component state — so a
 * filtered view can be reloaded, shared, and navigated back to; only the
 * filter controls themselves (WorkoutFilters) are a Client Component, this
 * page and the list below stay server-rendered. Queries the database
 * directly via lib/workouts instead of fetching /api/workouts over HTTP —
 * this is a Server Component running in the same process as the database
 * access layer, so a self-fetch would only add a network round trip and a
 * duplicate auth check for no benefit. The API route stays in place as the
 * surface for later client-side use.
 */
export default async function WorkoutsPage(props: PageProps<"/workouts">) {
  const user = await requireUser();
  const rawSearchParams = await props.searchParams;
  const filters = parseWorkoutListSearchParams(rawSearchParams);

  const [userWorkouts, tagCatalog] = await Promise.all([
    getWorkoutsForUser(user.id, filters),
    getTagCatalog(),
  ]);

  const hasActiveFilters =
    filters.q !== undefined ||
    filters.primaryType !== undefined ||
    filters.difficulty !== undefined ||
    filters.favoritesOnly === true ||
    (filters.tagIds?.length ?? 0) > 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Workouts</h1>

      <Link href="/workouts/new" className="text-sm underline">
        New workout
      </Link>

      <WorkoutFilters
        q={filters.q ?? ""}
        primaryType={filters.primaryType ?? ""}
        difficulty={filters.difficulty ?? ""}
        favoritesOnly={filters.favoritesOnly ?? false}
        tagIds={filters.tagIds ?? []}
        primaryTypeOptions={workoutPrimaryTypeEnum.enumValues}
        difficultyOptions={workoutDifficultyEnum.enumValues}
        tagCatalog={tagCatalog}
      />

      {userWorkouts.length === 0 ? (
        <p className="text-sm text-gray-600">
          {hasActiveFilters ? (
            <>
              No workouts match these filters.{" "}
              <Link href="/workouts" className="underline">
                Clear filters
              </Link>
            </>
          ) : (
            "No workouts yet."
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {userWorkouts.map((workout) => (
            <li
              key={workout.id}
              className="rounded border border-gray-300 p-3"
            >
              <div className="flex items-center gap-2">
                <Link href={`/workouts/${workout.id}`} className="underline">
                  {workout.title}
                </Link>
                <FavoriteToggle
                  isFavorite={workout.isFavorite}
                  toggleFavoriteAction={toggleFavorite.bind(null, workout.id)}
                />
              </div>
              <p className="text-sm text-gray-600">
                {workout.primaryType} · {workout.difficulty}
              </p>
              {workout.workoutTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {workout.workoutTags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className={`rounded-full border px-2 py-0.5 text-xs ${TAG_COLOR_CLASSES[tag.color]}`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

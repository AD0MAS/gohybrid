import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getTagCatalog } from "@/lib/tags";
import { getWorkoutsForUser } from "@/lib/workouts";
import { parseWorkoutListSearchParams } from "@/lib/workouts-filters";
import { toggleFavorite } from "./actions";
import { DIFFICULTY_LABELS } from "./difficulty-labels";
import FavoriteToggle from "./FavoriteToggle";
import { PRIMARY_TYPE_LABELS } from "./primary-type-labels";
import { TAG_COLOR_CLASSES } from "./tag-colors";
import WorkoutFilters from "./WorkoutFilters";

export const metadata: Metadata = {
  title: "My Workouts",
};

/** The three explanatory cards under the empty-state hero's divider —
 * orients a brand-new user to what this page holds once workouts exist,
 * mirroring the corner button's own "History" wording rather than the
 * fuller "Training history" phrase used elsewhere. */
const EMPTY_STATE_HINTS = [
  {
    title: "The full list",
    body: "Every workout you own, sorted newest first or by title.",
  },
  {
    title: "Filters and tags",
    body: "Narrow by type — running, strength, HYROX, conditioning — or by tag.",
  },
  {
    title: "History",
    body: "Every completed session, with the workout it came from.",
  },
] as const;

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
 *
 * Named "My Workouts" in the UI rather than
 * "Library" — in Roxfit "Workout Library" means a catalogue of ready-made
 * workouts; here it's the user's own. A top-level nav destination (see
 * Nav.tsx), so it carries no BackLink — the four top-level routes are
 * always one tap away in the sidebar or bottom bar.
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

  // Nothing to filter and the hero below already carries the page's one
  // primary action — same "the section's own CTA replaces the header's"
  // rule /profile's GoalForm/hasAnyGoal applies. Filters still render for
  // the filtered-to-zero case, where they're exactly what the user needs.
  const isEmptyWithNoFilters = userWorkouts.length === 0 && !hasActiveFilters;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-5 sm:gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="truncate text-xl font-semibold text-ink">My Workouts</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/history"
              className="flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              History
            </Link>
            {!isEmptyWithNoFilters && (
              <div className="hidden sm:block">
                <Link
                  href="/workouts/new"
                  className="flex h-11 w-full items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto"
                >
                  New workout
                </Link>
              </div>
            )}
          </div>
        </div>
        {!isEmptyWithNoFilters && (
          <div className="sm:hidden">
            <Link
              href="/workouts/new"
              className="flex h-11 w-full items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto"
            >
              New workout
            </Link>
          </div>
        )}
      </div>

      {!isEmptyWithNoFilters && (
        <WorkoutFilters
          q={filters.q ?? ""}
          primaryType={filters.primaryType ?? ""}
          difficulty={filters.difficulty ?? ""}
          favoritesOnly={filters.favoritesOnly ?? false}
          tagIds={filters.tagIds ?? []}
          sort={filters.sort}
          primaryTypeOptions={workoutPrimaryTypeEnum.enumValues}
          difficultyOptions={workoutDifficultyEnum.enumValues}
          tagCatalog={tagCatalog}
        />
      )}

      {userWorkouts.length === 0 ? (
        hasActiveFilters ? (
          <div className="rounded-panel border border-hairline bg-surface-1 p-8 text-center">
            <p className="text-sm text-ink-subtle">
              No workouts match these filters.{" "}
              <Link
                href="/workouts"
                className="text-ink underline hover:text-accent active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              >
                Clear filters
              </Link>
            </p>
          </div>
        ) : (
          <section className="flex flex-col gap-6 rounded-panel border border-hairline bg-surface-1 p-6 sm:p-8">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-accent-ink-subtle">
                Your library
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                Nothing in the library yet
              </h2>
              <p className="max-w-xl text-sm text-ink-subtle">
                A workout is a reusable template: blocks of items with sets,
                volume, intensity, weight and rest. Build one here, then
                schedule it from Home.
              </p>
            </div>

            <Link
              href="/workouts/new"
              className="flex h-11 w-full items-center justify-center self-start rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto"
            >
              Create your first workout
            </Link>

            <div className="flex flex-col gap-3 border-t border-surface-3 pt-6">
              <p className="text-xs font-medium text-ink-subtle">
                What lives on this page once you have workouts
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {EMPTY_STATE_HINTS.map((hint) => (
                  <div
                    key={hint.title}
                    className="flex flex-col gap-1 rounded-card border border-hairline bg-surface-2 p-4"
                  >
                    <p className="text-sm font-medium text-ink-muted">
                      {hint.title}
                    </p>
                    <p className="text-xs text-ink-tertiary">{hint.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      ) : (
        <section className="rounded-panel border border-hairline bg-surface-1 p-5">
          <ul className="flex flex-col">
            {userWorkouts.map((workout) => (
              <li
                key={workout.id}
                className="relative flex items-center justify-between gap-4 border-b border-surface-3 py-4 last:border-b-0 hover:bg-surface-2 has-[a:active]:bg-surface-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/workouts/${workout.id}`}
                      className="truncate text-[15px] font-medium text-ink after:absolute after:inset-0 hover:text-accent active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                    >
                      {workout.title}
                    </Link>
                    <div className="relative z-10 shrink-0">
                      <FavoriteToggle
                        isFavorite={workout.isFavorite}
                        toggleFavoriteAction={toggleFavorite.bind(
                          null,
                          workout.id
                        )}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-ink-tertiary">
                    {[
                      PRIMARY_TYPE_LABELS[workout.primaryType].label,
                      DIFFICULTY_LABELS[workout.difficulty].label,
                      workout.estimatedDurationMinutes != null &&
                        `${workout.estimatedDurationMinutes} min`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {workout.workoutTags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {workout.workoutTags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className={`rounded-small border px-3 py-0.5 text-xs ${TAG_COLOR_CLASSES[tag.color]}`}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-ink-subtle"
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

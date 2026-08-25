import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { isOneOf, isValidUuid } from "./workouts-validation";

export const WORKOUT_SORT_OPTIONS = [
  "newest",
  "oldest",
  "title",
  "updated",
] as const;

export type WorkoutSort = (typeof WORKOUT_SORT_OPTIONS)[number];

const DEFAULT_WORKOUT_SORT: WorkoutSort = "newest";

export type WorkoutListFilters = {
  q?: string;
  primaryType?: (typeof workoutPrimaryTypeEnum.enumValues)[number];
  difficulty?: (typeof workoutDifficultyEnum.enumValues)[number];
  tagIds?: string[];
  favoritesOnly?: boolean;
  sort: WorkoutSort;
};

function firstValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toIdList(value: string | string[] | undefined): string[] {
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(isValidUuid);
}

/**
 * Parses the /workouts/library page's URL search params into a
 * WorkoutListFilters object for getWorkoutsForUser. Every filter field is
 * independently validated and simply omitted when malformed or unrecognized
 * — a hand-edited or stale URL (e.g. `primaryType=bogus`, a deleted tag's
 * id) degrades to "no filter on that field" rather than erroring the page.
 * `tags` accepts either a comma-separated value or repeated `tags=` params,
 * since both are valid ways to represent a multi-value query param.
 *
 * `sort` is not a filter — there is always a sort order, so it's returned
 * as a required field, falling back to "newest" when missing or
 * unrecognized rather than being omitted.
 */
export function parseWorkoutListSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): WorkoutListFilters {
  const filters: WorkoutListFilters = { sort: DEFAULT_WORKOUT_SORT };

  const q = firstValue(searchParams.q)?.trim();
  if (q) {
    filters.q = q;
  }

  const primaryType = firstValue(searchParams.primaryType);
  if (isOneOf(primaryType, workoutPrimaryTypeEnum.enumValues)) {
    filters.primaryType = primaryType;
  }

  const difficulty = firstValue(searchParams.difficulty);
  if (isOneOf(difficulty, workoutDifficultyEnum.enumValues)) {
    filters.difficulty = difficulty;
  }

  const tagIds = toIdList(searchParams.tags);
  if (tagIds.length > 0) {
    filters.tagIds = tagIds;
  }

  if (firstValue(searchParams.favorites) === "true") {
    filters.favoritesOnly = true;
  }

  const sort = firstValue(searchParams.sort);
  if (isOneOf(sort, WORKOUT_SORT_OPTIONS)) {
    filters.sort = sort;
  }

  return filters;
}

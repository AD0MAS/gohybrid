import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { isOneOf, isValidUuid } from "./workouts-validation";

export type WorkoutListFilters = {
  q?: string;
  primaryType?: (typeof workoutPrimaryTypeEnum.enumValues)[number];
  difficulty?: (typeof workoutDifficultyEnum.enumValues)[number];
  tagIds?: string[];
  favoritesOnly?: boolean;
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
 * Parses the /workouts page's URL search params into a WorkoutListFilters
 * object for getWorkoutsForUser. Every field is independently validated and
 * simply omitted when malformed or unrecognized — a hand-edited or stale
 * URL (e.g. `primaryType=bogus`, a deleted tag's id) degrades to "no filter
 * on that field" rather than erroring the page. `tags` accepts either a
 * comma-separated value or repeated `tags=` params, since both are valid
 * ways to represent a multi-value query param.
 */
export function parseWorkoutListSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): WorkoutListFilters {
  const filters: WorkoutListFilters = {};

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

  return filters;
}

import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import {
  checkTextLength,
  WORKOUT_DESCRIPTION_MAX_LENGTH,
  WORKOUT_TITLE_MAX_LENGTH,
} from "./text-limits";

export type ValidatedWorkoutInput = {
  title: string;
  description: string | null;
  primaryType: (typeof workoutPrimaryTypeEnum.enumValues)[number];
  difficulty: (typeof workoutDifficultyEnum.enumValues)[number];
  estimatedDurationMinutes: number | null;
};

export type WorkoutValidationResult =
  | { success: true; data: ValidatedWorkoutInput }
  | { success: false; error: string };

/** Raw, untyped workout-creation input as received from either a JSON
 * request body or a FormData submission. */
export type RawWorkoutInput = {
  title?: unknown;
  description?: unknown;
  primaryType?: unknown;
  difficulty?: unknown;
  estimatedDurationMinutes?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a string is a syntactically valid UUID. Used to guard
 * workout-detail lookups (by id) before they reach the database — an
 * obviously-invalid id would otherwise surface as a raw Postgres error
 * instead of a clean 404. Shared by GET /api/workouts/[id] and the
 * /workouts/[id] detail page.
 */
export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T
): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/**
 * Validates and normalizes workout-creation input. Shared by the
 * POST /api/workouts Route Handler and the /workouts/new Server Action so
 * the two never drift apart. Rules: title is required and non-empty;
 * primaryType and difficulty must be one of the enum values defined in
 * db/schema.ts; estimatedDurationMinutes, if present, must be a positive
 * integer.
 */
export function validateWorkoutInput(
  input: RawWorkoutInput
): WorkoutValidationResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { success: false, error: "Title is required." };
  }
  const titleCheck = checkTextLength(title, WORKOUT_TITLE_MAX_LENGTH, "Title");
  if (!titleCheck.ok) {
    return { success: false, error: titleCheck.error };
  }

  const primaryType = input.primaryType;
  if (!isOneOf(primaryType, workoutPrimaryTypeEnum.enumValues)) {
    return {
      success: false,
      error: `primaryType must be one of: ${workoutPrimaryTypeEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const difficulty = input.difficulty;
  if (!isOneOf(difficulty, workoutDifficultyEnum.enumValues)) {
    return {
      success: false,
      error: `difficulty must be one of: ${workoutDifficultyEnum.enumValues.join(
        ", "
      )}.`,
    };
  }

  const description =
    typeof input.description === "string" && input.description.trim() !== ""
      ? input.description.trim()
      : null;
  if (description !== null) {
    const descriptionCheck = checkTextLength(
      description,
      WORKOUT_DESCRIPTION_MAX_LENGTH,
      "Description"
    );
    if (!descriptionCheck.ok) {
      return { success: false, error: descriptionCheck.error };
    }
  }

  let estimatedDurationMinutes: number | null = null;
  const rawDuration = input.estimatedDurationMinutes;
  if (rawDuration !== undefined && rawDuration !== null && rawDuration !== "") {
    const parsed =
      typeof rawDuration === "number" ? rawDuration : Number(rawDuration);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return {
        success: false,
        error: "estimatedDurationMinutes must be a positive integer.",
      };
    }
    estimatedDurationMinutes = parsed;
  }

  return {
    success: true,
    data: {
      title,
      description,
      primaryType,
      difficulty,
      estimatedDurationMinutes,
    },
  };
}

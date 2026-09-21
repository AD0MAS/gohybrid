import { workoutDifficultyEnum, workoutPrimaryTypeEnum } from "@/db/schema";
import { checkDigitLimit, DURATION_MINUTES_DIGIT_LIMIT } from "./numeric-limits";
import {
  checkTextLength,
  LONG_TEXT_MAX_LENGTH,
  NAME_MAX_LENGTH,
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
  const titleCheck = checkTextLength(title, NAME_MAX_LENGTH, "Title");
  if (!titleCheck.ok) {
    return { success: false, error: titleCheck.error };
  }

  const primaryType = input.primaryType;
  if (!isOneOf(primaryType, workoutPrimaryTypeEnum.enumValues)) {
    return {
      success: false,
      error: "Choose a valid primary type.",
    };
  }

  const difficulty = input.difficulty;
  if (!isOneOf(difficulty, workoutDifficultyEnum.enumValues)) {
    return {
      success: false,
      error: "Choose a valid difficulty.",
    };
  }

  const description =
    typeof input.description === "string" && input.description.trim() !== ""
      ? input.description.trim()
      : null;
  if (description !== null) {
    const descriptionCheck = checkTextLength(
      description,
      LONG_TEXT_MAX_LENGTH,
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
        error: "Estimated duration must be a positive integer.",
      };
    }
    const digitCheck = checkDigitLimit(
      parsed,
      DURATION_MINUTES_DIGIT_LIMIT,
      "Estimated duration"
    );
    if (!digitCheck.ok) {
      return { success: false, error: digitCheck.error };
    }
    estimatedDurationMinutes = digitCheck.value;
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

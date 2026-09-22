import { NextResponse } from "next/server";
import { BLOCK_TYPES, TARGET_PRESETS, TARGET_TYPES, VOLUME_TYPES, WORKOUT_DIFFICULTIES, WORKOUT_PRIMARY_TYPES } from "@/db/enums";
import { getAuthenticatedUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { validateBuilderPayload } from "@/lib/workout-builder-validation";
import { createFullWorkoutForUser } from "@/lib/workouts";

const STATIC_ENUM_OPTIONS = {
  primaryTypeOptions: WORKOUT_PRIMARY_TYPES,
  difficultyOptions: WORKOUT_DIFFICULTIES,
  blockTypeOptions: BLOCK_TYPES,
  volumeTypeOptions: VOLUME_TYPES,
  targetTypeOptions: TARGET_TYPES,
  targetPresetOptions: TARGET_PRESETS,
};

/**
 * POST /api/workouts/full
 * Creates a full workout — with blocks and items — for the authenticated
 * user in one transaction (see createFullWorkoutForUser). Responds 401
 * if there is no authenticated user, 400 with a validation message on
 * invalid input, and 201 with the created workout on success. This is
 * the API surface for the same operation the builder's Save button
 * performs via the createFullWorkout Server Action.
 */
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const exerciseCatalog = await getExerciseCatalog();
  const result = validateBuilderPayload(body, {
    ...STATIC_ENUM_OPTIONS,
    restExerciseIds: exerciseCatalog
      .filter((exercise) => exercise.category === "rest")
      .map((exercise) => exercise.id),
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const workout = await createFullWorkoutForUser(user.id, result.data);

  return NextResponse.json(workout, { status: 201 });
}

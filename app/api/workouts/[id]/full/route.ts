import { NextResponse } from "next/server";
import {
  blockTypeEnum,
  targetPresetEnum,
  targetTypeEnum,
  volumeTypeEnum,
  workoutDifficultyEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import { validateBuilderPayload } from "@/lib/workout-builder-validation";
import { updateFullWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";

const STATIC_ENUM_OPTIONS = {
  primaryTypeOptions: workoutPrimaryTypeEnum.enumValues,
  difficultyOptions: workoutDifficultyEnum.enumValues,
  blockTypeOptions: blockTypeEnum.enumValues,
  volumeTypeOptions: volumeTypeEnum.enumValues,
  targetTypeOptions: targetTypeEnum.enumValues,
  targetPresetOptions: targetPresetEnum.enumValues,
};

/**
 * PATCH /api/workouts/[id]/full
 * Replaces one of the authenticated user's workouts — the workout row,
 * its blocks, and each block's items — in one transaction (see
 * updateFullWorkoutForUser). Every existing block is deleted (items
 * cascade) and the submitted tree is re-inserted. This is the API
 * surface for the same operation the builder's Save button performs in
 * edit mode via the updateFullWorkout Server Action. Responds 401 if
 * there is no authenticated user, 400 with a validation message on
 * invalid input, and 404 both when the id doesn't exist and when it
 * belongs to a different user — deliberately indistinguishable, same as
 * GET/PATCH/DELETE /api/workouts/[id].
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/workouts/[id]/full">
) {
  const { id } = await context.params;

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const workout = await updateFullWorkoutForUser(id, user.id, result.data);

  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(workout);
}

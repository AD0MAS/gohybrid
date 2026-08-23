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
import { createFullWorkoutForUser } from "@/lib/workouts";
import { validateBuilderPayload } from "@/lib/workout-builder-validation";

const ENUM_OPTIONS = {
  primaryTypeOptions: workoutPrimaryTypeEnum.enumValues,
  difficultyOptions: workoutDifficultyEnum.enumValues,
  blockTypeOptions: blockTypeEnum.enumValues,
  volumeTypeOptions: volumeTypeEnum.enumValues,
  targetTypeOptions: targetTypeEnum.enumValues,
  targetPresetOptions: targetPresetEnum.enumValues,
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

  const result = validateBuilderPayload(body, ENUM_OPTIONS);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const workout = await createFullWorkoutForUser(user.id, result.data);

  return NextResponse.json(workout, { status: 201 });
}

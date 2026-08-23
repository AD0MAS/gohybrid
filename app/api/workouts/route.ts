import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createWorkoutForUser, getWorkoutsForUser } from "@/lib/workouts";
import { validateWorkoutInput } from "@/lib/workouts-validation";

/**
 * GET /api/workouts
 * Returns the authenticated user's workouts, most recently created first.
 * Responds 401 if there is no authenticated user.
 */
export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userWorkouts = await getWorkoutsForUser(user.id);

  return NextResponse.json(userWorkouts);
}

/**
 * POST /api/workouts
 * Creates a workout owned by the authenticated user. Responds 401 if there
 * is no authenticated user, 400 with a validation message on invalid
 * input, and 201 with the created workout on success. user_id is always
 * taken from the authenticated session, never from the request body — a
 * client cannot create a workout on another user's behalf.
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

  const result = validateWorkoutInput(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const created = await createWorkoutForUser(user.id, result.data);

  return NextResponse.json(created, { status: 201 });
}

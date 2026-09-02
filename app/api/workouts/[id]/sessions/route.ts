import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSessionForWorkout } from "@/lib/sessions";
import { getUserContext } from "@/lib/user-settings";
import { isValidUuid } from "@/lib/workouts-validation";

/**
 * POST /api/workouts/[id]/sessions
 * Records that the authenticated user completed one of their workouts,
 * creating a workout_session with the workout's current title and
 * primary_type copied on as snapshots. Responds 401 if there is no
 * authenticated user, 404 both when the id doesn't exist and when it
 * belongs to a different user, and 201 with the created session on
 * success.
 */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/workouts/[id]/sessions">
) {
  const { id } = await context.params;

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { today } = await getUserContext(user.id);
  const session = await createSessionForWorkout(user.id, id, {
    kind: "sameDay",
    date: today,
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(session, { status: 201 });
}

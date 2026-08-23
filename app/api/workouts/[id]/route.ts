import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getWorkoutForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";

/**
 * GET /api/workouts/[id]
 * Returns one of the authenticated user's workouts with its blocks and
 * items nested. Responds 401 if there is no authenticated user. Responds
 * 404 both when the id doesn't exist and when it belongs to a different
 * user — deliberately indistinguishable, so a request can't be used to
 * confirm that a given workout id exists at all.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/workouts/[id]">
) {
  const { id } = await context.params;

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workout = await getWorkoutForUser(id, user.id);

  if (!workout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(workout);
}

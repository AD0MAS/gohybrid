import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { markSkippedForUser, unscheduleForUser } from "@/lib/scheduled-workouts";
import { isValidUuid } from "@/lib/workouts-validation";

/**
 * PATCH /api/scheduled-workouts/[id]
 * Sets is_skipped on one of the authenticated user's scheduled workouts.
 * Responds 401 if there is no authenticated user, 400 if isSkipped isn't a
 * boolean, and 404 both when the id doesn't exist and when it belongs to a
 * different user. Returns the updated row as JSON on success.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/scheduled-workouts/[id]">
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
  if (!body || typeof body !== "object" || typeof body.isSkipped !== "boolean") {
    return NextResponse.json(
      { error: "isSkipped must be a boolean." },
      { status: 400 }
    );
  }

  const updated = await markSkippedForUser(id, user.id, body.isSkipped);

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/scheduled-workouts/[id]
 * Removes one of the authenticated user's scheduled workouts. Responds 401
 * if there is no authenticated user, 404 both when the id doesn't exist
 * and when it belongs to a different user, and 204 No Content on success.
 * Any linked workout_session is untouched — see unscheduleForUser.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/scheduled-workouts/[id]">
) {
  const { id } = await context.params;

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deleted = await unscheduleForUser(id, user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

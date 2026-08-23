import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  deleteWorkoutForUser,
  getWorkoutForUser,
  updateWorkoutForUser,
} from "@/lib/workouts";
import { isValidUuid, validateWorkoutInput } from "@/lib/workouts-validation";

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

/**
 * PATCH /api/workouts/[id]
 * Updates one of the authenticated user's workouts. Responds 401 if there
 * is no authenticated user, 400 with a validation message on invalid
 * input, and 404 both when the id doesn't exist and when it belongs to a
 * different user — same indistinguishable-404 rule as GET. Returns the
 * updated workout as JSON on success.
 */
export async function PATCH(
  request: Request,
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

  const updated = await updateWorkoutForUser(id, user.id, result.data);

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/workouts/[id]
 * Deletes one of the authenticated user's workouts. Responds 401 if there
 * is no authenticated user, 404 both when the id doesn't exist and when
 * it belongs to a different user, and 204 No Content on success.
 */
export async function DELETE(
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

  const deleted = await deleteWorkoutForUser(id, user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

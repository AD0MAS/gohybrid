import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { toggleFavoriteForUser } from "@/lib/workouts";
import { isValidUuid } from "@/lib/workouts-validation";

/**
 * POST /api/workouts/[id]/favorite
 * Flips is_favorite for one of the authenticated user's workouts.
 * Responds 401 if there is no authenticated user, 404 both when the id
 * doesn't exist and when it belongs to a different user, and returns the
 * new is_favorite value as JSON on success.
 */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/workouts/[id]/favorite">
) {
  const { id } = await context.params;

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isFavorite = await toggleFavoriteForUser(id, user.id);

  if (isFavorite === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ isFavorite });
}

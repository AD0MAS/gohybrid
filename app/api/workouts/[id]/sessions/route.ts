import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSessionForWorkout } from "@/lib/sessions";
import { validateSessionDuration } from "@/lib/sessions-validation";
import { getUserContext } from "@/lib/user-settings";
import { isValidUuid } from "@/lib/uuid";

/**
 * POST /api/workouts/[id]/sessions
 * Records that the authenticated user completed one of their workouts,
 * creating a workout_session with the workout's current title and
 * primary_type copied on as snapshots. The body is optional: an empty body
 * creates a session with no duration, and `{ "durationSeconds": 1800 }`
 * records the active time (a whole number of seconds, 1 to 86400). Responds
 * 401 if there is no authenticated user, 404 both when the id doesn't exist
 * and when it belongs to a different user, 400 for a body that is not a JSON
 * object or carries an invalid duration, and 201 with the created session on
 * success.
 */
export async function POST(
  request: Request,
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

  // An empty body stays valid — callers predating the duration field send none.
  let rawDuration: unknown = null;
  const text = await request.text();
  if (text.trim() !== "") {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }
    rawDuration = (body as { durationSeconds?: unknown }).durationSeconds;
  }

  const duration = validateSessionDuration(rawDuration);
  if (!duration.success) {
    return NextResponse.json({ error: duration.error }, { status: 400 });
  }

  const { today, timezone } = await getUserContext(user.id);
  const session = await createSessionForWorkout(
    user.id,
    id,
    { kind: "sameDay", date: today, timezone },
    { durationSeconds: duration.data }
  );

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(session, { status: 201 });
}

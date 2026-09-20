import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getScheduledWorkoutForUser,
  markSkippedForUser,
  rescheduleForUser,
  unscheduleForUser,
} from "@/lib/scheduled-workouts";
import { validateScheduleInput } from "@/lib/scheduled-workouts-validation";
import { getUserContext } from "@/lib/user-settings";
import { isValidUuid } from "@/lib/uuid";

/**
 * PATCH /api/scheduled-workouts/[id]
 * Two independent updates on one of the authenticated user's scheduled
 * workouts, distinguished by which key the body carries — mirrors
 * rescheduleWorkout/markScheduledWorkoutSkipped
 * (app/(app)/upcoming-actions.ts), the Server Actions this route stays in
 * sync with rather than being called by (the REST routes stay as the app's
 * HTTP surface, unused by its own pages):
 *   - `{ isSkipped: boolean }` sets is_skipped, unchanged from before.
 *   - `{ scheduledDate: string, scheduledTime?, notes? }` reschedules the
 *     entry via the same validateScheduleInput + rescheduleForUser pair the
 *     Server Action uses, including both halves of the past rule (against
 *     `today`/`now`, resolved here via getUserContext) and the
 *     completed-entry rejection.
 * Responds 401 if there is no authenticated user, 400 if the body matches
 * neither shape or fails validation, 404 if the id doesn't exist or isn't
 * owned by the user, and — for a reschedule specifically — 400 (not 404) if
 * the entry exists and is owned but is already Completed, since that's a
 * real state the caller can act on rather than a nonexistent resource.
 * Returns the updated row as JSON on success.
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
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  if (typeof body.isSkipped === "boolean") {
    const updated = await markSkippedForUser(id, user.id, body.isSkipped);

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  }

  if (typeof body.scheduledDate === "string") {
    const entry = await getScheduledWorkoutForUser(id, user.id);
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (entry.sessionId) {
      return NextResponse.json(
        { error: "A completed entry can't be rescheduled." },
        { status: 400 }
      );
    }

    const { today, now } = await getUserContext(user.id);
    const result = validateScheduleInput(
      {
        workoutId: entry.workoutId,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
        notes: body.notes,
      },
      today,
      now
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updated = await rescheduleForUser(
      id,
      user.id,
      result.data.scheduledDate,
      result.data.scheduledTime,
      result.data.notes
    );
    if (!updated) {
      return NextResponse.json(
        { error: "This entry can no longer be rescheduled." },
        { status: 400 }
      );
    }

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    {
      error:
        "The request must specify either whether this workout was skipped, or a new scheduledDate.",
    },
    { status: 400 }
  );
}

/**
 * DELETE /api/scheduled-workouts/[id]
 * Removes one of the authenticated user's scheduled workouts. Responds 401
 * if there is no authenticated user, 404 both when the id doesn't exist
 * and when it belongs to a different user, and 204 No Content on success.
 * If the entry was Completed (session_id NOT NULL), its linked
 * workout_session is deleted along with it — see unscheduleForUser.
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

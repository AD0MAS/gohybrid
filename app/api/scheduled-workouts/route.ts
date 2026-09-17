import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { scheduleWorkoutForUser } from "@/lib/scheduled-workouts";
import { validateScheduleInput } from "@/lib/scheduled-workouts-validation";
import { getUserContext } from "@/lib/user-settings";

/**
 * POST /api/scheduled-workouts
 * Schedules one of the authenticated user's workouts for a given date, which
 * must be today or later — and, if it's today, a time that is now or later
 * (validateScheduleInput, against `today`/`now` resolved here via
 * getUserContext — same source the Server Action uses, so the two never
 * disagree about what day or time it is). Responds 401 if there is no
 * authenticated user, 400 with a validation message on invalid input
 * (including a past date or an already-elapsed time today), and 404 if the
 * workoutId doesn't exist or isn't owned by the user — same
 * indistinguishable-404 rule used throughout /api/workouts. Returns the
 * created scheduled_workouts row as JSON, 201, on success.
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

  const { today, now } = await getUserContext(user.id);
  const result = validateScheduleInput(body, today, now);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const created = await scheduleWorkoutForUser(
    user.id,
    result.data.workoutId,
    result.data.scheduledDate,
    result.data.scheduledTime,
    result.data.notes
  );

  if (!created) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(created, { status: 201 });
}

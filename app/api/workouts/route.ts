import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workouts } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { validateWorkoutInput } from "@/app/workouts/validation";

/**
 * GET /api/workouts
 * Returns the authenticated user's workouts, most recently created first.
 * Responds 401 if there is no authenticated user. Since RLS is disabled on
 * this database, the explicit `eq(workouts.userId, user.id)` filter below
 * is the only thing preventing one user from reading another user's
 * workouts — it must never be dropped from this query.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userWorkouts = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, user.id))
    .orderBy(desc(workouts.createdAt));

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const [created] = await db
    .insert(workouts)
    .values({
      userId: user.id,
      title: result.data.title,
      description: result.data.description,
      primaryType: result.data.primaryType,
      difficulty: result.data.difficulty,
      estimatedDurationMinutes: result.data.estimatedDurationMinutes,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

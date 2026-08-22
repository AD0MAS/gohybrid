import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workouts } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

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

import { db } from "@/db";
import { exercises } from "@/db/schema";

/**
 * Reads one row from the exercise catalog. Exists only so the keep-alive
 * cron has a real query against a real table to run: Supabase pauses a
 * Free-plan project that sees too little database activity in a week, and
 * a bare `SELECT 1` may not count as user activity. The catalog is not
 * user-scoped, so no `userId` is involved.
 */
export async function pingDatabase() {
  await db.select({ id: exercises.id }).from(exercises).limit(1);
}

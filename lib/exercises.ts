import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";

/**
 * Fetches the full exercise catalog, ordered by name. The catalog is
 * small (currently ~43 rows) and not user-scoped, so callers — the
 * workout builder — filter it client-side rather than querying per
 * keystroke.
 */
export async function getExerciseCatalog() {
  return db.select().from(exercises).orderBy(asc(exercises.name));
}

/**
 * Fetches a single exercise by id, or null if it doesn't exist. Used by
 * the Personal Records write path (personal-records-actions.ts) to look
 * up `isHyroxStation` for a distance PR's exercise before converting the
 * user's imperial input to metres — see resolveDistanceInputUnit in
 * lib/units.ts.
 */
export async function getExerciseById(id: string) {
  const [exercise] = await db.select().from(exercises).where(eq(exercises.id, id));
  return exercise ?? null;
}

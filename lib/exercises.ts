import { asc } from "drizzle-orm";
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

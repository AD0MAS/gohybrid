import { asc } from "drizzle-orm";
import { db } from "@/db";
import { tags } from "@/db/schema";

/**
 * Fetches the full tag catalog, ordered by name. Tags are a system-wide
 * catalog (no user_id column — same shape as exercises), so this isn't
 * scoped to a user; the workout builder renders it as a multi-select.
 */
export async function getTagCatalog() {
  return db.select().from(tags).orderBy(asc(tags.name));
}

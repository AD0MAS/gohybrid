import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { personalRecords } from "@/db/schema";
import type { ValidatedPersonalRecordInput } from "./personal-records-validation";

// PersonalRecord (the row shape), subjectKey, isBetterRecord,
// PersonalRecordGroup and groupPersonalRecordsBySubject live in
// lib/personal-records-grouping.ts, a dependency-free module — see its own
// file comment. The type is re-exported below (type-only, erased at
// compile time) so existing `import type { PersonalRecord } from
// "@/lib/personal-records"` call sites keep working; the functions
// themselves are NOT re-exported here on purpose, since re-exporting a
// runtime value from this module would still route an importer through
// this file's own `db` import above — callers that need them import
// directly from lib/personal-records-grouping.ts instead.
import type { PersonalRecord } from "./personal-records-grouping";
export type { PersonalRecord };

/**
 * Drizzle returns `numeric` columns as strings, so every row read from
 * personal_records is mapped through this to give
 * callers an actual number for `value`.
 */
function toPersonalRecord(
  row: typeof personalRecords.$inferSelect & {
    exercise: { id: string; name: string; isHyroxStation: boolean } | null;
  }
): PersonalRecord {
  return { ...row, value: Number(row.value) };
}

/**
 * Lists `userId`'s personal records, most recently achieved first (created_at
 * desc as a tiebreaker between same-day records), each with its related
 * exercise nested in one query. `userId` is a required first parameter, not
 * read from a session internally — with RLS disabled, this filter is the
 * only thing preventing one user from reading another user's records.
 */
export async function getPersonalRecordsForUser(
  userId: string
): Promise<PersonalRecord[]> {
  const rows = await db.query.personalRecords.findMany({
    where: (personalRecords, { eq }) => eq(personalRecords.userId, userId),
    orderBy: (personalRecords, { desc }) => [
      desc(personalRecords.achievedAt),
      desc(personalRecords.createdAt),
    ],
    with: {
      exercise: {
        columns: { id: true, name: true, isHyroxStation: true },
      },
    },
  });

  return rows.map(toPersonalRecord);
}

/**
 * Records one personal record for `userId`. `input` is already validated
 * (see validatePersonalRecordInput in lib/personal-records-validation.ts);
 * `input.value` is a number here and converted to a string on the way in,
 * since Drizzle's `numeric` columns are written as strings.
 */
export async function createPersonalRecordForUser(
  userId: string,
  input: ValidatedPersonalRecordInput
): Promise<PersonalRecord> {
  const [created] = await db
    .insert(personalRecords)
    .values({
      userId,
      exerciseId: input.exerciseId,
      customName: input.customName,
      recordType: input.recordType,
      value: String(input.value),
      achievedAt: input.achievedAt,
      notes: input.notes,
    })
    .returning();

  const exercise = input.exerciseId
    ? await db.query.exercises.findFirst({
        where: (exercises, { eq }) => eq(exercises.id, input.exerciseId!),
        columns: { id: true, name: true, isHyroxStation: true },
      })
    : null;

  return toPersonalRecord({ ...created, exercise: exercise ?? null });
}

/**
 * Updates a personal record owned by `userId`, returning the updated
 * PersonalRecord or null if nothing matched — whether because the id
 * doesn't exist or because it belongs to a different user. Ownership is
 * enforced in the WHERE clause, same pattern as deletePersonalRecordForUser.
 * `input` is already validated — an update has the same rules as a create
 * (see validatePersonalRecordInput), and the write shape mirrors
 * createPersonalRecordForUser's exactly.
 */
export async function updatePersonalRecordForUser(
  id: string,
  userId: string,
  input: ValidatedPersonalRecordInput
): Promise<PersonalRecord | null> {
  const [updated] = await db
    .update(personalRecords)
    .set({
      exerciseId: input.exerciseId,
      customName: input.customName,
      recordType: input.recordType,
      value: String(input.value),
      achievedAt: input.achievedAt,
      notes: input.notes,
    })
    .where(and(eq(personalRecords.id, id), eq(personalRecords.userId, userId)))
    .returning();

  if (!updated) return null;

  const exercise = input.exerciseId
    ? await db.query.exercises.findFirst({
        where: (exercises, { eq }) => eq(exercises.id, input.exerciseId!),
        columns: { id: true, name: true, isHyroxStation: true },
      })
    : null;

  return toPersonalRecord({ ...updated, exercise: exercise ?? null });
}

/**
 * Resolves the canonical spelling for a subject `userId` refers to by
 * `customName`: the earliest-recorded personal_records row whose customName
 * matches case-insensitively, or `customName` itself unchanged when no such
 * row exists yet. Called by the write path (addPersonalRecord,
 * updatePersonalRecord, addGoal, updateGoal — all in app/(app)/profile/)
 * before validation, so "maratonas", "Maratonas" and "MaraTonas" — which
 * subjectKey already treats as one subject for grouping/comparison — also
 * end up stored as one spelling: whichever the user typed first. Later
 * writes reusing any case variant of that spelling snap back to it, so new
 * rows can no longer diverge from each other the way old ones could.
 *
 * `excludeRecordId` lets updatePersonalRecord exclude the very row being
 * edited from the lookup — otherwise a record that's the sole holder of a
 * spelling could never have that spelling's casing corrected, since the
 * lookup would just find itself and hand its own (pre-edit) text back.
 */
export async function resolveCanonicalCustomName(
  userId: string,
  customName: string,
  excludeRecordId?: string
): Promise<string> {
  const conditions = [
    eq(personalRecords.userId, userId),
    sql`lower(${personalRecords.customName}) = lower(${customName})`,
  ];
  if (excludeRecordId) {
    conditions.push(ne(personalRecords.id, excludeRecordId));
  }

  const [existing] = await db
    .select({ customName: personalRecords.customName })
    .from(personalRecords)
    .where(and(...conditions))
    .orderBy(personalRecords.createdAt)
    .limit(1);

  return existing?.customName ?? customName;
}

/**
 * Distinct custom_name values `userId` has ever recorded, alphabetically —
 * offered by PersonalRecordFields/GoalFields as a "previously used" group in
 * their exercise <select> so a subject like "maratonas" can be picked again
 * instead of retyped. One row per subject even for rows written before
 * resolveCanonicalCustomName existed and so may still disagree on case:
 * `DISTINCT ON (lower(custom_name))`, ordered by that same lowercased key
 * and then `created_at`, keeps the earliest-recorded spelling per group —
 * the same "first spelling wins" rule resolveCanonicalCustomName applies to
 * new writes, applied here as a read-side backstop for old ones.
 */
export async function getDistinctCustomNamesForUser(
  userId: string
): Promise<string[]> {
  const rows = await db
    .selectDistinctOn([sql`lower(${personalRecords.customName})`], {
      customName: personalRecords.customName,
    })
    .from(personalRecords)
    .where(
      and(eq(personalRecords.userId, userId), isNotNull(personalRecords.customName))
    )
    .orderBy(sql`lower(${personalRecords.customName})`, personalRecords.createdAt);

  return rows
    .map((row) => row.customName)
    .filter((name): name is string => name !== null)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Deletes a personal record owned by `userId`, returning true if a row was
 * deleted and false otherwise — whether because the id doesn't exist or
 * because it belongs to a different user. Ownership is enforced in the
 * WHERE clause, same pattern as deleteBodyMetricForUser.
 */
export async function deletePersonalRecordForUser(
  id: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(personalRecords)
    .where(and(eq(personalRecords.id, id), eq(personalRecords.userId, userId)))
    .returning({ id: personalRecords.id });

  return deleted.length > 0;
}

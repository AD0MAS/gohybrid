import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { personalRecords, personalRecordTypeEnum } from "@/db/schema";
import type { ValidatedPersonalRecordInput } from "./personal-records-validation";

export type PersonalRecord = {
  id: string;
  userId: string;
  exerciseId: string | null;
  customName: string | null;
  recordType: (typeof personalRecordTypeEnum.enumValues)[number];
  value: number;
  achievedAt: string;
  notes: string | null;
  createdAt: Date;
  exercise: { id: string; name: string; isHyroxStation: boolean } | null;
};

/**
 * Drizzle returns `numeric` columns as strings (see GOHYBRID_PLAN.md §6),
 * so every row read from personal_records is mapped through this to give
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

/**
 * Pure comparison for two values of the same record_type: true if `a` is a
 * strictly better record than `b`. Direction is derived from record_type
 * rather than stored as a column — "time" is lower-is-better (a faster
 * time), everything else (weight, reps, distance) is higher-is-better.
 * Kept separate from any query, same principle as computeStreaks, so the
 * direction logic can be reasoned about and tested on its own.
 */
export function isBetterRecord(
  recordType: (typeof personalRecordTypeEnum.enumValues)[number],
  a: number,
  b: number
): boolean {
  return recordType === "time" ? a < b : a > b;
}

/** A personal record's subject+type: the catalog exercise id (or custom
 * name, lowercased) — the two are mutually exclusive per row — plus
 * record_type. record_type is part of the key because values of different
 * types (e.g. a "Run" distance PR and a "Run" time PR) aren't comparable.
 * customName is lowercased here (comparison only — the stored value keeps
 * whatever case the user typed) so "maratonas" and "Maratonas" group as one
 * subject instead of splitting into two by accident of capitalization.
 * Exported so lib/goals.ts can look up a group by the same subject+type
 * identity a personal-record goal targets, without redefining the key
 * format. */
export function subjectKey(record: {
  exerciseId: string | null;
  customName: string | null;
  recordType: (typeof personalRecordTypeEnum.enumValues)[number];
}): string {
  const subject = record.exerciseId
    ? `exercise:${record.exerciseId}`
    : `custom:${(record.customName ?? "").toLowerCase()}`;
  return `${subject}:${record.recordType}`;
}

export type PersonalRecordGroup = {
  subjectKey: string;
  subjectLabel: string;
  recordType: (typeof personalRecordTypeEnum.enumValues)[number];
  best: PersonalRecord;
  history: PersonalRecord[];
};

/**
 * Groups `records` by subject (exercise_id when present, otherwise
 * custom_name) and picks the current best per group via isBetterRecord.
 * `history` is every record for that subject, including `best`, in the
 * order they were passed in (getPersonalRecordsForUser already returns
 * newest-achieved-first, so no re-sort happens here). A subject tracked
 * under two record types (e.g. "Run" distance and "Run" time) deliberately
 * produces two groups — their values aren't comparable, so isBetterRecord
 * can't pick a single "best" across them.
 */
export function groupPersonalRecordsBySubject(
  records: PersonalRecord[]
): PersonalRecordGroup[] {
  const groups = new Map<string, PersonalRecordGroup>();

  for (const record of records) {
    const key = subjectKey(record);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        subjectKey: key,
        subjectLabel: record.exercise?.name ?? record.customName ?? "Unknown",
        recordType: record.recordType,
        best: record,
        history: [record],
      });
      continue;
    }

    existing.history.push(record);
    if (isBetterRecord(record.recordType, record.value, existing.best.value)) {
      existing.best = record;
    }
  }

  return Array.from(groups.values());
}

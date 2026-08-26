import { and, eq } from "drizzle-orm";
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
  exercise: { id: string; name: string } | null;
};

/**
 * Drizzle returns `numeric` columns as strings (see GOHYBRID_PLAN.md §6),
 * so every row read from personal_records is mapped through this to give
 * callers an actual number for `value`.
 */
function toPersonalRecord(
  row: typeof personalRecords.$inferSelect & {
    exercise: { id: string; name: string } | null;
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
        columns: { id: true, name: true },
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
        columns: { id: true, name: true },
      })
    : null;

  return toPersonalRecord({ ...created, exercise: exercise ?? null });
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
 * name) — the two are mutually exclusive per row — plus record_type.
 * record_type is part of the key because values of different types (e.g. a
 * "Run" distance PR and a "Run" time PR) aren't comparable. */
function subjectKey(record: PersonalRecord): string {
  const subject = record.exerciseId ? `exercise:${record.exerciseId}` : `custom:${record.customName}`;
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

// No runtime imports of db/index.ts (or anything that reaches it) on
// purpose, same reasoning as lib/numeric-limits.ts and lib/exercise-groups.ts:
// everything below is pure (subjectKey, isBetterRecord,
// groupPersonalRecordsBySubject take plain data and return plain data, no
// query involved), so nothing here needs the `postgres` driver `db/index.ts`
// pulls in. Kept out of lib/personal-records.ts, which does need it (for its
// CRUD functions), specifically so a client component that only needs the
// grouping logic can import it without dragging that driver into the
// browser bundle. The `import type` from db/schema.ts below is erased at
// compile time, so it doesn't count.

import type { personalRecordTypeEnum } from "@/db/schema";

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

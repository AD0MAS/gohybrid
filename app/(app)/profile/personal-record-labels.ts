import type { personalRecordTypeEnum } from "@/db/schema";

type PersonalRecordType = (typeof personalRecordTypeEnum.enumValues)[number];

/**
 * Display label and unit per personal_record_type enum value — the record
 * type select, the value input, and the record list all read from here so
 * a value can't be labeled differently in two places. Same pattern as
 * BODY_METRIC_LABELS.
 */
export const PERSONAL_RECORD_LABELS: Record<
  PersonalRecordType,
  { label: string; unit: string }
> = {
  weight: { label: "Weight", unit: "kg" },
  time: { label: "Time", unit: "seconds" },
  reps: { label: "Reps", unit: "reps" },
  distance: { label: "Distance", unit: "metres" },
};

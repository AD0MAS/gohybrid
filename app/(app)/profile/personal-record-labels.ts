import type { personalRecordTypeEnum } from "@/db/schema";

type PersonalRecordType = (typeof personalRecordTypeEnum.enumValues)[number];

/**
 * Display label per personal_record_type enum value — the record type
 * select and the record list both read from here so a value can't be
 * labeled differently in two places. No `unit` field here: the unit
 * depends on the viewing user's unit_system (and, for weight/distance,
 * actually converts), so it comes from lib/units.ts's
 * formatPersonalRecordValue, not this map — one definition per unit.
 * Same pattern as BODY_METRIC_LABELS.
 */
export const PERSONAL_RECORD_LABELS: Record<
  PersonalRecordType,
  { label: string }
> = {
  weight: { label: "Weight" },
  time: { label: "Time" },
  reps: { label: "Reps" },
  distance: { label: "Distance" },
  calories: { label: "Calories" },
};

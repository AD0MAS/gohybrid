import type { WORKOUT_DIFFICULTIES } from "@/db/enums";

type Difficulty = (typeof WORKOUT_DIFFICULTIES)[number];

/**
 * Display label per difficulty enum value. Same placement reasoning as
 * PRIMARY_TYPE_LABELS (./primary-type-labels.ts) — difficulty is read
 * outside the builder too, so it lives alongside it rather than under
 * workouts/builder/.
 */
export const DIFFICULTY_LABELS: Record<Difficulty, { label: string }> = {
  low: { label: "Low" },
  medium: { label: "Medium" },
  high: { label: "High" },
};

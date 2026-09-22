import type { VOLUME_TYPES } from "@/db/enums";

type VolumeType = (typeof VOLUME_TYPES)[number];

/**
 * Display label per volume_type enum value — the volume type select and the
 * item summary row both read from here so a value can't be labeled
 * differently in two places. Same convention as BLOCK_TYPE_LABELS
 * (block-type-labels.ts) / BODY_METRIC_LABELS (app/(app)/profile/body-metric-labels.ts).
 */
export const VOLUME_TYPE_LABELS: Record<VolumeType, { label: string }> = {
  duration: { label: "Duration" },
  distance: { label: "Distance" },
  reps: { label: "Reps" },
  calories: { label: "Calories" },
};

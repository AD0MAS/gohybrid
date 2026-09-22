import type { WORKOUT_PRIMARY_TYPES } from "@/db/enums";

type PrimaryType = (typeof WORKOUT_PRIMARY_TYPES)[number];

/**
 * Display label per primary_type enum value. Lives here rather than in
 * workouts/builder/ (unlike BLOCK_TYPE_LABELS/TARGET_TYPE_LABELS/
 * TARGET_PRESET_LABELS/VOLUME_TYPE_LABELS) because primary_type is read
 * outside the builder — the workout detail page, the library list, the
 * week strip, Start Workout — not just inside it, the same reasoning
 * TAG_COLOR_CLASSES (./tag-colors.ts) is already placed at this level
 * instead of nested under builder/.
 */
export const PRIMARY_TYPE_LABELS: Record<PrimaryType, { label: string }> = {
  running: { label: "Running" },
  strength: { label: "Strength" },
  hyrox: { label: "HYROX" },
  conditioning: { label: "Conditioning" },
  other: { label: "Other" },
};

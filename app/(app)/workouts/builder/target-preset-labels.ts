import type { targetPresetEnum } from "@/db/schema";

type TargetPreset = (typeof targetPresetEnum.enumValues)[number];

/**
 * Display label per target_preset enum value — the target preset select and
 * the item summary row both read from here so a value can't be labeled
 * differently in two places. Same convention as BLOCK_TYPE_LABELS
 * (block-type-labels.ts) / BODY_METRIC_LABELS (app/(app)/profile/body-metric-labels.ts).
 */
export const TARGET_PRESET_LABELS: Record<TargetPreset, { label: string }> = {
  threshold: { label: "Threshold" },
  race_pace: { label: "Race pace" },
  zone2: { label: "Zone 2" },
  tempo: { label: "Tempo" },
  recovery: { label: "Recovery" },
};

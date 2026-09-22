import type { BLOCK_TYPES } from "@/db/enums";

type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Display label per block_type enum value — the block type select and the
 * block summary row both read from here so a value can't be labeled
 * differently in two places. Same convention as BODY_METRIC_LABELS
 * (app/(app)/profile/body-metric-labels.ts).
 */
export const BLOCK_TYPE_LABELS: Record<BlockType, { label: string }> = {
  for_time: { label: "For Time" },
  on_off: { label: "On/Off" },
  amrap: { label: "AMRAP" },
  emom: { label: "EMOM" },
  general: { label: "General" },
};

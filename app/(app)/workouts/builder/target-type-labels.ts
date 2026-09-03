import type { targetTypeEnum } from "@/db/schema";

type TargetType = (typeof targetTypeEnum.enumValues)[number];

/**
 * Display label per target_type enum value — the target type select and the
 * item summary row both read from here so a value can't be labeled
 * differently in two places. Same convention as BLOCK_TYPE_LABELS
 * (block-type-labels.ts) / BODY_METRIC_LABELS (app/(app)/profile/body-metric-labels.ts).
 */
export const TARGET_TYPE_LABELS: Record<TargetType, { label: string }> = {
  pace_500m: { label: "Pace /500m" },
  pace_km: { label: "Pace /km" },
  cal_per_hour: { label: "Cal/h" },
  watts: { label: "Watts" },
  rpe: { label: "RPE" },
};

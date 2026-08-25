import type { bodyMetricTypeEnum } from "@/db/schema";

type BodyMetricType = (typeof bodyMetricTypeEnum.enumValues)[number];

/**
 * Display label and unit per body_metric_type enum value — the metric
 * type select, the measurement list, and the delete confirmation all read
 * from here so a value can't be labeled differently in two places. Units
 * are always the DB's metric/SI units (kg, %, bpm); converting for display
 * is a Layer 4 Settings concern, not implemented yet.
 */
export const BODY_METRIC_LABELS: Record<
  BodyMetricType,
  { label: string; unit: string }
> = {
  weight: { label: "Weight", unit: "kg" },
  body_fat: { label: "Body fat", unit: "%" },
  resting_hr: { label: "Resting HR", unit: "bpm" },
};

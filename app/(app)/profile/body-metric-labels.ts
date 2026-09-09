import type { bodyMetricTypeEnum } from "@/db/schema";

type BodyMetricType = (typeof bodyMetricTypeEnum.enumValues)[number];

/**
 * Display label per body_metric_type enum value — the metric type select
 * and the measurement list both read from here so a value can't be
 * labeled differently in two places. No `unit` field here: the unit
 * depends on the viewing user's unit_system (and, for weight, actually
 * converts), so it comes from lib/units.ts's formatBodyMetricValue, not
 * this map — one definition per unit.
 */
export const BODY_METRIC_LABELS: Record<BodyMetricType, { label: string }> = {
  weight: { label: "Weight" },
  body_fat: { label: "Body fat" },
  resting_hr: { label: "Resting HR" },
};

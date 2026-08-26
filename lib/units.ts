import type {
  bodyMetricTypeEnum,
  personalRecordTypeEnum,
  unitSystemEnum,
} from "@/db/schema";

type UnitSystem = (typeof unitSystemEnum.enumValues)[number];
type BodyMetricType = (typeof bodyMetricTypeEnum.enumValues)[number];
type PersonalRecordType = (typeof personalRecordTypeEnum.enumValues)[number];

// International definitions — exact, not approximations, so repeated
// round-trips (kg -> lb -> kg) don't drift.
const KG_PER_LB = 0.45359237;
const METRES_PER_FOOT = 0.3048;
const METRES_PER_MILE = 1609.344;

// Below this, a distance reads more naturally in feet than miles; at or
// above it, miles. Applied to the METRIC value, before any conversion —
// see formatDistanceMetres.
const FEET_TO_MILES_THRESHOLD_METRES = 1000;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function metresToFeet(m: number): number {
  return m / METRES_PER_FOOT;
}

export function feetToMetres(ft: number): number {
  return ft * METRES_PER_FOOT;
}

export function metresToMiles(m: number): number {
  return m / METRES_PER_MILE;
}

export function milesToMetres(mi: number): number {
  return mi * METRES_PER_MILE;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export type DisplayValue = {
  value: number;
  unit: string;
};

/**
 * Weight, converted for display only — the database always stores kg
 * (GOHYBRID_PLAN.md §5 Layer 4). `value` is always metric/SI in; never
 * pass an already-converted number in, and never feed the returned
 * `value` back into a lib/ comparison or aggregation (isBetterRecord,
 * computeGoalProgress, any query) — those must keep operating in kg.
 */
export function formatWeightKg(
  value: number,
  unitSystem: UnitSystem
): DisplayValue {
  if (unitSystem === "imperial") {
    return { value: round1(kgToLb(value)), unit: "lb" };
  }
  return { value: round1(value), unit: "kg" };
}

/**
 * Distance, converted for display only. `value` is always metres in.
 * `isHyroxStation` overrides the unit system entirely: an official HYROX
 * station's distance is always shown in metres, because the event itself
 * is defined in metric worldwide, even for competitors in imperial
 * locales. Otherwise, under imperial, the metric value decides feet vs.
 * miles (FEET_TO_MILES_THRESHOLD_METRES) — a 50 m distance reads far more
 * naturally as "164 ft" than "0.03 mi".
 */
export function formatDistanceMetres(
  value: number,
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): DisplayValue {
  if (unitSystem === "metric" || isHyroxStation) {
    return { value: round1(value), unit: "m" };
  }
  if (value < FEET_TO_MILES_THRESHOLD_METRES) {
    return { value: round1(metresToFeet(value)), unit: "ft" };
  }
  return { value: round1(metresToMiles(value)), unit: "mi" };
}

/**
 * Formats a body_metrics value for display given its metric_type. Only
 * "weight" converts (via formatWeightKg) — body_fat (%) and resting_hr
 * (bpm) are unit-system-independent by nature and are returned unchanged
 * on purpose. Do not "complete" this mapping by inventing a conversion for
 * either; there isn't one.
 */
export function formatBodyMetricValue(
  metricType: BodyMetricType,
  value: number,
  unitSystem: UnitSystem
): DisplayValue {
  if (metricType === "weight") {
    return formatWeightKg(value, unitSystem);
  }
  return { value, unit: metricType === "body_fat" ? "%" : "bpm" };
}

/**
 * Formats a personal_records value for display given its record_type.
 * "weight" converts via formatWeightKg; "distance" converts via
 * formatDistanceMetres (so `isHyroxStation` only matters for this branch).
 * "reps" (a count) and "time" (seconds) are unit-system-independent by
 * nature and are returned unchanged on purpose — do not "complete" this
 * mapping by inventing a conversion for either.
 */
export function formatPersonalRecordValue(
  recordType: PersonalRecordType,
  value: number,
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): DisplayValue {
  if (recordType === "weight") {
    return formatWeightKg(value, unitSystem);
  }
  if (recordType === "distance") {
    return formatDistanceMetres(value, unitSystem, isHyroxStation);
  }
  return { value, unit: recordType === "reps" ? "reps" : "seconds" };
}

/**
 * The unit a distance personal-record INPUT is entered in — deliberately
 * simpler than formatDistanceMetres' three-way display rule (m/ft/mi):
 * the person typing a value doesn't yet know what it'll convert to, so
 * there's no sensible way to offer them a threshold-dependent choice.
 * Under imperial, every distance is entered in feet unless the chosen
 * exercise is a HYROX station, in which case metres (official HYROX
 * distances are always metric); under metric, always metres. Shared by
 * the Personal Records form (for its input placeholder) and its Server
 * Action (for the actual conversion), so the two can't drift apart — same
 * principle as the shared validators.
 */
export function resolveDistanceInputUnit(
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): "m" | "ft" {
  return unitSystem === "imperial" && !isHyroxStation ? "ft" : "m";
}

/**
 * Converts a weight value the user typed into the metric kg the database
 * stores. Identity under metric. The write-side counterpart to
 * formatWeightKg — call this in the Server Action, before validation;
 * validatePersonalRecordInput/validateBodyMetricInput must only ever see
 * a metric number.
 */
export function convertWeightInputToKg(
  value: number,
  unitSystem: UnitSystem
): number {
  return unitSystem === "imperial" ? lbToKg(value) : value;
}

/**
 * Converts a distance value the user typed into the metric metres the
 * database stores, per resolveDistanceInputUnit's unit choice. The
 * write-side counterpart to formatDistanceMetres — call this in the
 * Server Action, before validation.
 */
export function convertDistanceInputToMetres(
  value: number,
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): number {
  return resolveDistanceInputUnit(unitSystem, isHyroxStation) === "ft"
    ? feetToMetres(value)
    : value;
}

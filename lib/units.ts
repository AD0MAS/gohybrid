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
const METRES_PER_KM = 1000;

/**
 * The units DistanceInput's own <select> offers — metric (m, km) or
 * imperial (ft, mi), chosen by the user rather than inferred from the
 * value (see convertDistanceInputToMetres below). Exported so both
 * DistanceInput (app/(app)/_components/DistanceInput.tsx) and the Server
 * Actions that read its submitted unit off FormData (addPersonalRecord,
 * updatePersonalRecord, addGoal, updateGoal) validate against the same
 * list via isOneOf.
 */
export const DISTANCE_INPUT_UNITS = ["m", "km", "ft", "mi"] as const;
export type DistanceInputUnit = (typeof DISTANCE_INPUT_UNITS)[number];

// Below this, a distance reads more naturally in the smaller unit (m or
// ft) than the larger one (km or mi); at or above it, the larger unit.
// Shared by both unit systems in formatDistanceMetres — one threshold,
// same cutoff distance either way, just a different pair of units either
// side of it. Renamed from FEET_TO_MILES_THRESHOLD_METRES now that it
// also decides m vs. km, not only ft vs. mi.
const DISTANCE_UNIT_SWITCH_THRESHOLD_METRES = 1000;

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

export function metresToKm(m: number): number {
  return m / METRES_PER_KM;
}

export function kmToMetres(km: number): number {
  return km * METRES_PER_KM;
}

/**
 * Pace conversion — seconds per kilometre <-> seconds per mile. Unlike
 * DistanceInput's m/km/ft/mi, which all convert into and out of one
 * canonical metres value, pace_500m and pace_km are deliberately NOT
 * interconvertible ("/500m is its own value, no conversion" — a rower
 * thinking in pace-per-500m and a runner thinking
 * in pace-per-km aren't the same mode). Only /km and /mi share one stored
 * quantity (target_type = pace_km, target_value always seconds-per-km), the
 * same way DistanceInput's m/km or ft/mi pairs do, so only that pair gets a
 * conversion function. The ratio is the same METRES_PER_MILE/METRES_PER_KM
 * used for distance — a pace is time per unit distance, so scaling the unit
 * distance by that ratio scales the time the same way.
 */
export function secondsPerKmToSecondsPerMile(secondsPerKm: number): number {
  return secondsPerKm * (METRES_PER_MILE / METRES_PER_KM);
}

/** Inverse of secondsPerKmToSecondsPerMile. */
export function secondsPerMileToSecondsPerKm(secondsPerMile: number): number {
  return secondsPerMile * (METRES_PER_KM / METRES_PER_MILE);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export type DisplayValue = {
  value: number;
  unit: string;
};

/**
 * Weight, converted for display only — the database always stores kg.
 * `value` is always metric/SI in; never
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
 * locales. Otherwise the metric value decides which of the unit system's
 * own pair to use — m vs. km under metric, ft vs. mi under imperial — via
 * the shared DISTANCE_UNIT_SWITCH_THRESHOLD_METRES: a 50 m distance reads
 * far more naturally as "50 m"/"164 ft" than "0.05 km"/"0.03 mi", and an
 * 8000 m one as "8 km"/"5 mi" rather than "8000 m"/"26247 ft".
 */
export function formatDistanceMetres(
  value: number,
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): DisplayValue {
  if (isHyroxStation) {
    return { value: round1(value), unit: "m" };
  }
  if (unitSystem === "metric") {
    if (value < DISTANCE_UNIT_SWITCH_THRESHOLD_METRES) {
      return { value: round1(value), unit: "m" };
    }
    return { value: round1(metresToKm(value)), unit: "km" };
  }
  if (value < DISTANCE_UNIT_SWITCH_THRESHOLD_METRES) {
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
 * "reps" (a count), "time" (seconds) and "calories" (kcal) are
 * unit-system-independent by nature and are returned unchanged on purpose —
 * do not "complete" this mapping by inventing a conversion for any of them.
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
  if (recordType === "calories") {
    return { value, unit: "kcal" };
  }
  return { value, unit: recordType === "reps" ? "reps" : "seconds" };
}

/**
 * Formats a number of seconds as a clock string, the read-side
 * counterpart to DurationInput's seconds-in/seconds-out contract — pure
 * display, never fed back into a comparison or aggregation. Under a
 * minute: "0:45" (m:ss, with m literally 0). Under an hour: "23:00" (m:ss,
 * minutes not zero-padded). An hour or more: "1:30:00" (h:mm:ss).
 */
export function formatDurationSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secs}`;
  }
  return `${minutes}:${secs}`;
}

/**
 * Formats a pace target ("pace_500m" or "pace_km", target_value always
 * seconds-per-km — see secondsPerKmToSecondsPerMile's own doc comment)
 * for display: pace_500m always reads as /500m; pace_km reads as /km for a
 * metric user, /mi (converted) for an imperial one. Moved here verbatim
 * from three near-identical copies (ItemEditor's formatItemSummary, the
 * workout detail page's inline formatting, StartWorkoutClient's
 * formatItemDetails) — this module has no Server/Client boundary to worry
 * about, unlike those three call sites (one Server Component, two Client
 * Components), so it's the one place all of them can share. Callers are
 * expected to have already checked `targetValue !== null` and narrowed
 * `targetType` to one of the two pace variants themselves, same as before
 * this was extracted.
 */
export function formatPaceTarget(
  targetType: "pace_500m" | "pace_km",
  targetValue: number,
  unitSystem: UnitSystem
): string {
  const useMiles = targetType === "pace_km" && unitSystem === "imperial";
  const seconds = useMiles
    ? secondsPerKmToSecondsPerMile(targetValue)
    : targetValue;
  const unitLabel =
    targetType === "pace_500m" ? "/500m" : useMiles ? "/mi" : "/km";
  return `${formatDurationSeconds(seconds)} ${unitLabel}`;
}

/**
 * Text-ready version of formatPersonalRecordValue, for display sites that
 * render a record's value as a string (PersonalRecordsList, and GoalsList
 * via formatGoalValueText in goal-labels.ts) — never for the forms, which
 * still need formatPersonalRecordValue's raw numeric `.value` to seed a
 * number input, or DurationInput's `defaultValueSeconds` for "time"
 * (PersonalRecordFields, GoalFields). "time" doesn't read naturally as
 * "<number> <unit>" — nobody writes "1380 seconds" — so it routes through
 * formatDurationSeconds instead of appending formatPersonalRecordValue's
 * unit suffix. This is the "add a separate formatter" choice over widening
 * DisplayValue's `value` to `string | number`: DisplayValue.value is read
 * as a plain number at every other call site (form pre-fill, chart series
 * construction in lib/progress.ts), and only "time" ever needs a string —
 * widening the shared type would push a string-or-number check onto call
 * sites that can never actually see the string branch.
 */
export function formatPersonalRecordValueText(
  recordType: PersonalRecordType,
  value: number,
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): string {
  if (recordType === "time") {
    return formatDurationSeconds(value);
  }
  const display = formatPersonalRecordValue(
    recordType,
    value,
    unitSystem,
    isHyroxStation
  );
  return `${display.value} ${display.unit}`;
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
 * database stores, given the unit they explicitly picked in DistanceInput's
 * own <select> (app/(app)/_components/DistanceInput.tsx) — never inferred
 * from unitSystem/isHyroxStation the way weight's convertWeightInputToKg
 * still is. DistanceInput itself calls this for its controlled
 * (valueMetres/onChange) mode; the Server Actions call it a second time for
 * uncontrolled forms, using the unit submitted alongside the value in the
 * `${name}Unit` hidden input, before validation. See DistanceInput's doc
 * comment for why the input unit can't be inferred the way formatDistanceMetres
 * infers a *display* unit (the old resolveDistanceInputUnit/toDistanceInputValue
 * approach this replaced caused a silent corruption bug precisely because the
 * two didn't agree).
 */
export function convertDistanceInputToMetres(
  value: number,
  unit: DistanceInputUnit
): number {
  switch (unit) {
    case "m":
      return value;
    case "km":
      return kmToMetres(value);
    case "ft":
      return feetToMetres(value);
    case "mi":
      return milesToMetres(value);
  }
}

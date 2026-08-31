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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

/**
 * The read-side counterpart to convertDistanceInputToMetres: converts a
 * stored metric value into whatever unit resolveDistanceInputUnit reports
 * for the same unitSystem/isHyroxStation pair, for seeding a distance
 * input's value when editing an existing record/goal.
 *
 * This is deliberately NOT formatDistanceMetres. Display and input units
 * are different concepts for distance: formatDistanceMetres picks ft vs.
 * mi per value (a 1000 m threshold), because that's what reads naturally
 * on a list; resolveDistanceInputUnit is threshold-free (always ft, or m
 * for a HYROX station), because a value typed into an input is converted
 * with that same fixed unit on submit — see convertDistanceInputToMetres.
 * Seeding an input's value with the display unit but labelling it with the
 * input unit silently corrupts the value on save (e.g. a stored 4877 m
 * displays as "3 mi", but re-submitting "3" under the input's "ft" label
 * converts to ~0.9 m). Anything seeding a distance form field must use
 * this function, never formatDistanceMetres.
 */
export function toDistanceInputValue(
  metres: number,
  unitSystem: UnitSystem,
  isHyroxStation: boolean
): number {
  return resolveDistanceInputUnit(unitSystem, isHyroxStation) === "ft"
    ? round2(metresToFeet(metres))
    : round2(metres);
}

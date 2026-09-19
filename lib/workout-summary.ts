import type { unitSystemEnum } from "@/db/schema";
import {
  formatDistanceMetres,
  formatDurationSeconds,
  formatPaceTarget,
  formatWeightKg,
} from "./units";

// String-literal union rather than `typeof blockTypeEnum.enumValues[number]`
// — this module takes no dependency on db/schema at all, not even a
// type-only one, since it has nothing to do with how the value got here.
export type BlockTimingType =
  | "for_time"
  | "on_off"
  | "amrap"
  | "emom"
  | "general";

export type BlockTimingFields = {
  blockType: BlockTimingType;
  durationSeconds: number | null;
  rounds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  intervalSeconds: number | null;
};

function roundsPart(rounds: number): string {
  return `${rounds} round${rounds === 1 ? "" : "s"}`;
}

/**
 * One-line rendering of a block's timing fields for a read-only view, per
 * block_type — rounds first (the count that matters most at a glance), then
 * whichever duration fields the type has, each named ("time cap", "work",
 * "rest", "interval") rather than left as a bare number. Returns null when
 * the type carries no timing fields (general) or none of its fields are
 * filled in yet, so the caller can omit the line entirely.
 *
 * Shared by the workout detail page (which shows the block type as a badge
 * beside it) and, via formatBlockSummary below, the builder's block rows.
 */
export function formatBlockTimingLine(block: BlockTimingFields): string | null {
  switch (block.blockType) {
    case "for_time": {
      const parts = [
        block.rounds != null && roundsPart(block.rounds),
        block.durationSeconds != null &&
          `time cap ${formatDurationSeconds(block.durationSeconds)}`,
      ].filter((part): part is string => Boolean(part));
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "amrap":
      return block.durationSeconds != null
        ? `time cap ${formatDurationSeconds(block.durationSeconds)}`
        : null;
    case "on_off": {
      const parts = [
        block.rounds != null && roundsPart(block.rounds),
        block.workSeconds != null &&
          `work ${formatDurationSeconds(block.workSeconds)}`,
        block.restSeconds != null &&
          `rest ${formatDurationSeconds(block.restSeconds)}`,
      ].filter((part): part is string => Boolean(part));
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "emom": {
      const parts = [
        block.rounds != null && roundsPart(block.rounds),
        block.intervalSeconds != null &&
          `interval ${formatDurationSeconds(block.intervalSeconds)}`,
      ].filter((part): part is string => Boolean(part));
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "general":
      return null;
  }
}

// Label maps are UI copy and live in app/; lib/ takes them as a parameter
// and never imports them. Any Record<enum, { label }> from app/ fits.
type LabelMap = Readonly<Record<string, { label: string }>>;

export type ItemSummaryLabels = {
  targetPreset: LabelMap;
  targetType: LabelMap;
};

export type BlockSummaryLabels = {
  blockType: LabelMap;
};

/**
 * One item in the shape both the builder's draft state and a saved database
 * row map onto. Numbers may arrive as numbers (builder) or as Drizzle
 * `numeric` strings (rows); enum columns may be null (rows) or "" (builder
 * draft, its explicit unselected state). Both are treated as "not set".
 */
export type ItemSummaryInput = {
  isRestItem: boolean;
  isHyroxStation: boolean;
  sets: number | null;
  volumeType: string | null;
  volumeValue: number | string | null;
  targetType: string | null;
  targetValue: number | string | null;
  targetPreset: string | null;
  weightKg: number | string | null;
  restSeconds: number | null;
};

type UnitSystem = (typeof unitSystemEnum.enumValues)[number];

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * One-line item summary, shared by the builder's item rows and the workout
 * detail page: "1 × 12 reps · RPE 8 · 9 kg · 0:30 rest" for a regular item,
 * or just the duration ("1:00") / "Open ended" for a rest item, whose name
 * above the line already says "Rest". Each part is computed on its own and
 * an unset part is simply absent, so no stray separators.
 *
 * - Sets lead the volume ("3 × 12 reps"); with no volume they stand alone
 *   ("3 sets"); with no sets (a draft that has none yet) only the volume
 *   shows.
 * - A volume type with no value reads "Open ended" (a legacy row — every
 *   non-rest item now needs both).
 * - Distance goes through formatDistanceMetres, so a HYROX station stays in
 *   metres whatever the unit system; weight goes through formatWeightKg; a
 *   pace target through formatPaceTarget (/500m, or /km or /mi by unit
 *   system).
 * - Zero rest between sets is omitted.
 *
 * Returns null when nothing is configured, so the caller can drop the line.
 */
export function formatItemSummary(
  item: ItemSummaryInput,
  unitSystem: UnitSystem,
  labels: ItemSummaryLabels
): string | null {
  if (item.isRestItem) {
    return item.restSeconds != null
      ? formatDurationSeconds(item.restSeconds)
      : "Open ended";
  }

  let volume: string | null = null;
  if (item.volumeType) {
    const value = toNumberOrNull(item.volumeValue);
    if (value === null) {
      volume = "Open ended";
    } else if (item.volumeType === "distance") {
      const distance = formatDistanceMetres(
        value,
        unitSystem,
        item.isHyroxStation
      );
      volume = `${distance.value} ${distance.unit}`;
    } else if (item.volumeType === "duration") {
      volume = formatDurationSeconds(value);
    } else {
      volume = `${value} ${item.volumeType === "calories" ? "kcal" : "reps"}`;
    }
  }

  let target: string | null = null;
  const targetValue = toNumberOrNull(item.targetValue);
  if (item.targetPreset) {
    target = labels.targetPreset[item.targetPreset]?.label ?? null;
  } else if (item.targetType) {
    const label = labels.targetType[item.targetType]?.label ?? null;
    if (item.targetType === "pace_500m" || item.targetType === "pace_km") {
      target =
        targetValue === null
          ? label
          : formatPaceTarget(item.targetType, targetValue, unitSystem);
    } else if (label !== null) {
      target = targetValue !== null ? `${label} ${targetValue}` : label;
    }
  }

  // A stored 0 reads the same as unset (bodyweight), so nothing to show.
  const weightKg = toNumberOrNull(item.weightKg);
  const weightDisplay =
    weightKg !== null && weightKg > 0
      ? formatWeightKg(weightKg, unitSystem)
      : null;
  const weight = weightDisplay
    ? `${weightDisplay.value} ${weightDisplay.unit}`
    : null;

  const rest =
    item.restSeconds != null && item.restSeconds > 0
      ? `${formatDurationSeconds(item.restSeconds)} rest`
      : null;

  const setsAndVolume =
    volume !== null
      ? item.sets !== null
        ? `${item.sets} × ${volume}`
        : volume
      : item.sets !== null
        ? `${item.sets} set${item.sets === 1 ? "" : "s"}`
        : null;

  const parts = [setsAndVolume, target, weight, rest].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The builder's block summary line: the block type's label, its timing
 * (formatBlockTimingLine) and the item count — "EMOM · 20 rounds · interval
 * 1:00 · 2 items". The workout detail page shows the type as a badge and
 * calls formatBlockTimingLine directly, so it does not use this.
 */
export function formatBlockSummary(
  block: BlockTimingFields,
  itemCount: number,
  labels: BlockSummaryLabels
): string {
  const parts = [
    labels.blockType[block.blockType]?.label,
    formatBlockTimingLine(block),
    `${itemCount} item${itemCount === 1 ? "" : "s"}`,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

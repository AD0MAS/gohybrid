import { formatDurationSeconds } from "./units";

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
 * Deliberately not the same wording as the builder's own formatBlockTiming
 * (BlockEditor.tsx) — that one is tuned for a compact, already-labeled
 * summary row next to an EMOM/AMRAP badge the user is actively editing
 * ("1:00 × 20"); this is for a page with no editing affordance, where the
 * words carry meaning the badge alone doesn't. Lives in lib/, not next to
 * either caller, so the eventual builder redesign has one place to adopt
 * this wording from instead of inventing a third convention.
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

export type ItemSummaryLineInput = {
  isRestItem: boolean;
  /** The rest item's own duration (rest_seconds doubles as this — see
   * db/CLAUDE.md). Ignored when isRestItem is false. */
  restSeconds: number | null;
  sets: number;
  /** Already unit-resolved by the caller (formatDistanceMetres,
   * formatDurationSeconds, "12 reps", "180 kcal", …) — this module owns how
   * the pieces combine, not what a volume_type/target_type/target_preset
   * value is called, which stays with the label maps that already own it. */
  volumeText: string | null;
  targetText: string | null;
  weightText: string | null;
  /** Rest *between sets*, already formatted as a duration (e.g. "0:30"),
   * with no "rest" word yet — this function adds it. Not to be confused
   * with `restSeconds` above, the rest item's own duration. */
  restBetweenText: string | null;
};

/**
 * One-line item summary for a read-only view — "1 × 12 reps · RPE 8" for a
 * regular item, or just the duration ("1:00") / "Open ended" for a rest
 * item, whose name above the line already says "Rest". Same shape as the
 * builder's own formatItemSummary (ItemEditor.tsx), which this doesn't
 * reuse directly since it works on client-side draft state
 * (`volumeType: VolumeType | ""`) rather than saved rows — but the join
 * order, separators and omission rules are identical on purpose, so the two
 * read as one convention today and can converge onto this function once the
 * builder is redesigned.
 */
export function formatItemSummaryLine(
  input: ItemSummaryLineInput
): string | null {
  if (input.isRestItem) {
    return input.restSeconds != null
      ? formatDurationSeconds(input.restSeconds)
      : "Open ended";
  }

  // Sets always show for a non-rest item: with a volume they lead it
  // ("3 × 12 reps"), without one they stand alone ("3 sets") rather than
  // vanishing from the line.
  const volumePart = input.volumeText
    ? `${input.sets} × ${input.volumeText}`
    : `${input.sets} set${input.sets === 1 ? "" : "s"}`;
  const restPart = input.restBetweenText
    ? `${input.restBetweenText} rest`
    : null;

  const parts = [volumePart, input.targetText, input.weightText, restPart].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

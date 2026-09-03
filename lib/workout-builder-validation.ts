// db/schema.ts is imported type-only below — erased at compile time. This
// file must have zero RUNTIME imports of db/schema.ts (or drizzle-orm),
// since it's called directly from the client-side workout builder for
// immediate feedback. It's kept out of lib/workouts-validation.ts
// specifically because that module has a *runtime* import of db/schema.ts
// for validateWorkoutInput — sharing a file with it would drag drizzle-orm
// into the client bundle the moment the builder imports anything from that
// module at all. lib/numeric-limits.ts is imported at runtime below, which
// is safe: it has zero imports of its own (see its own file comment).
import type {
  blockTypeEnum,
  targetPresetEnum,
  targetTypeEnum,
  volumeTypeEnum,
  workoutDifficultyEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";
import {
  checkDigitLimit,
  DURATION_MINUTES_DIGIT_LIMIT,
  ITEM_CALORIES_DIGIT_LIMIT,
  ITEM_DISTANCE_DIGIT_LIMIT,
  ITEM_PACE_DIGIT_LIMIT,
  ITEM_TARGET_RATE_DIGIT_LIMIT,
  LIFTED_WEIGHT_DIGIT_LIMIT,
  REPS_DIGIT_LIMIT,
} from "./numeric-limits";

export type ValidatedBuilderItem = {
  exerciseId: string | null;
  customName: string | null;
  sets: number;
  volumeType: (typeof volumeTypeEnum.enumValues)[number] | null;
  volumeValue: number | null;
  targetType: (typeof targetTypeEnum.enumValues)[number] | null;
  targetValue: number | null;
  targetPreset: (typeof targetPresetEnum.enumValues)[number] | null;
  weightKg: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type ValidatedBuilderBlock = {
  title: string | null;
  blockType: (typeof blockTypeEnum.enumValues)[number];
  durationSeconds: number | null;
  rounds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  intervalSeconds: number | null;
  items: ValidatedBuilderItem[];
};

export type ValidatedBuilderPayload = {
  title: string;
  description: string | null;
  primaryType: (typeof workoutPrimaryTypeEnum.enumValues)[number];
  difficulty: (typeof workoutDifficultyEnum.enumValues)[number];
  estimatedDurationMinutes: number | null;
  blocks: ValidatedBuilderBlock[];
  tagIds: string[];
};

export type BuilderValidationResult =
  | { success: true; data: ValidatedBuilderPayload }
  | { success: false; error: string };

/**
 * The enum value lists validateBuilderPayload checks against, supplied
 * by the caller rather than imported from db/schema.ts at runtime. This
 * is what keeps validateBuilderPayload safe to call from client code:
 * the builder already has these option lists as props (it uses them to
 * render its <select>s) and passes them straight through; the Server
 * Action and Route Handler pass the real enum values, which they can
 * import freely since they only ever run on the server.
 */
export type BuilderEnumOptions = {
  primaryTypeOptions: readonly string[];
  difficultyOptions: readonly string[];
  blockTypeOptions: readonly string[];
  volumeTypeOptions: readonly string[];
  targetTypeOptions: readonly string[];
  targetPresetOptions: readonly string[];
};

type RawBuilderItemPayload = {
  exerciseId?: unknown;
  customName?: unknown;
  sets?: unknown;
  volumeType?: unknown;
  volumeValue?: unknown;
  targetType?: unknown;
  targetValue?: unknown;
  targetPreset?: unknown;
  weightKg?: unknown;
  restSeconds?: unknown;
  notes?: unknown;
};

type RawBuilderBlockPayload = {
  title?: unknown;
  blockType?: unknown;
  durationSeconds?: unknown;
  rounds?: unknown;
  workSeconds?: unknown;
  restSeconds?: unknown;
  intervalSeconds?: unknown;
  items?: unknown;
};

/** Raw, untyped full-workout payload as built by the client builder (or
 * sent directly to POST /api/workouts/full). */
export type RawBuilderPayload = {
  title?: unknown;
  description?: unknown;
  primaryType?: unknown;
  difficulty?: unknown;
  estimatedDurationMinutes?: unknown;
  blocks?: unknown;
  tagIds?: unknown;
};

function isOneOf(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

// Duplicated from lib/workouts-validation.ts's isValidUuid rather than
// imported from it — that module has a runtime import of db/schema.ts,
// and this file must stay free of one (see the module comment above).
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Distinct from `null` (explicitly "not set") and any real parsed
 * value — signals "the caller provided something, but it's not valid". */
const INVALID = Symbol("invalid");

/** The subset of a block's editable fields BlockEditor's modal holds as a
 * draft — title is deliberately excluded, since it has no validation rule
 * (parseBuilderBlock only ever trims it). */
export type BuilderBlockDraft = {
  blockType: (typeof blockTypeEnum.enumValues)[number];
  durationSeconds: number | null;
  rounds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  intervalSeconds: number | null;
};

/** Per-field validation errors for a single block draft. Every key is
 * optional; an empty object means the draft is valid. Unlike
 * parseBuilderBlock's single combined error string, this reports every
 * failing field at once, so BlockEditor's modal can show them all
 * simultaneously under their own fields instead of one at a time across
 * repeated Save clicks. */
export type BuilderBlockDraftErrors = {
  blockType?: string;
  durationSeconds?: string;
  rounds?: string;
  workSeconds?: string;
  restSeconds?: string;
  intervalSeconds?: string;
};

/**
 * Validates one block's own fields in isolation — the same rules
 * parseBuilderBlock applies to a block within the full payload (see its
 * own comment above), reworded for a single field rather than prefixed
 * with "Block N", and with no item-level rules (BlockEditor's draft never
 * touches items — ItemEditor's own draft/validation is a separate step).
 * Used by BlockEditor's modal for immediate, per-field feedback on Save;
 * validateBuilderPayload remains the actual gate run against the whole
 * tree when the workout itself is saved.
 */
export function validateBuilderBlockDraft(
  draft: BuilderBlockDraft,
  blockTypeOptions: readonly string[]
): BuilderBlockDraftErrors {
  const errors: BuilderBlockDraftErrors = {};

  if (!isOneOf(draft.blockType, blockTypeOptions)) {
    errors.blockType = "Invalid block type.";
  }

  if (draft.durationSeconds !== null && draft.durationSeconds <= 0) {
    errors.durationSeconds = "Duration must be positive.";
  }

  if (draft.rounds !== null) {
    if (!Number.isInteger(draft.rounds)) {
      errors.rounds = "Rounds must be a whole number.";
    } else if (draft.rounds <= 0) {
      errors.rounds = "Rounds must be positive.";
    }
  }

  if (draft.workSeconds !== null && draft.workSeconds <= 0) {
    errors.workSeconds = "Work time must be positive.";
  }

  if (draft.restSeconds !== null && draft.restSeconds <= 0) {
    errors.restSeconds = "Rest time must be positive.";
  }

  if (draft.intervalSeconds !== null && draft.intervalSeconds <= 0) {
    errors.intervalSeconds = "Interval must be positive.";
  }

  if (draft.blockType === "amrap" && draft.durationSeconds === null) {
    errors.durationSeconds = "An AMRAP block needs a duration.";
  }

  if (draft.blockType === "on_off") {
    if (draft.workSeconds === null) {
      errors.workSeconds = "An on/off block needs a work time.";
    }
    if (draft.restSeconds === null) {
      errors.restSeconds = "An on/off block needs a rest time.";
    }
    if (draft.rounds === null) {
      errors.rounds = "An on/off block needs a number of rounds.";
    }
  }

  if (draft.blockType === "emom") {
    if (draft.intervalSeconds === null) {
      errors.intervalSeconds = "An EMOM block needs an interval.";
    }
    if (draft.rounds === null) {
      errors.rounds = "An EMOM block needs a number of rounds.";
    }
  }

  return errors;
}

/**
 * Validates the workout's selected tag ids. Like `exerciseId` on an item,
 * a tag id is only checked for being a syntactically valid UUID here, not
 * cross-checked against the tag catalog — an id that doesn't exist in
 * `tags` is caught by the workout_tags foreign key at insert time instead.
 * Duplicate ids are silently collapsed rather than rejected, since the
 * multi-select UI can't produce them but a hand-built request could.
 */
function parseTagIds(value: unknown): string[] | typeof INVALID {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return INVALID;
  }

  const tagIds: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string" || !UUID_REGEX.test(raw)) {
      return INVALID;
    }
    if (!tagIds.includes(raw)) {
      tagIds.push(raw);
    }
  }
  return tagIds;
}

function parseOptionalEnumValue(
  value: unknown,
  allowed: readonly string[]
): string | null | typeof INVALID {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "string" && allowed.includes(value)) {
    return value;
  }
  return INVALID;
}

function parseOptionalNumber(value: unknown): number | null | typeof INVALID {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? INVALID : parsed;
}

function parseBuilderItem(
  raw: unknown,
  options: BuilderEnumOptions,
  context: string
): { item: ValidatedBuilderItem } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: `${context} is invalid.` };
  }
  const item = raw as RawBuilderItemPayload;

  const exerciseId =
    typeof item.exerciseId === "string" && item.exerciseId !== ""
      ? item.exerciseId
      : null;
  const customName =
    typeof item.customName === "string" && item.customName.trim() !== ""
      ? item.customName.trim()
      : null;

  if (exerciseId !== null && customName !== null) {
    return {
      error: `${context} cannot have both an exercise and a custom name.`,
    };
  }
  if (exerciseId === null && customName === null) {
    return { error: `${context} needs either an exercise or a custom name.` };
  }

  const parsedSets = parseOptionalNumber(item.sets);
  const sets = parsedSets === null ? 1 : parsedSets;
  if (sets === INVALID || !Number.isInteger(sets) || sets < 1) {
    return { error: `${context} sets must be a positive integer.` };
  }

  const volumeType = parseOptionalEnumValue(
    item.volumeType,
    options.volumeTypeOptions
  );
  if (volumeType === INVALID) {
    return { error: `${context} has an invalid volume type.` };
  }

  let volumeValue = parseOptionalNumber(item.volumeValue);
  if (volumeValue === INVALID) {
    return { error: `${context} volume value must be a number.` };
  }
  // Checked regardless of volume_type — a negative duration/distance/reps/
  // calories is meaningless the same way for all four, and the UI's own
  // inputs (DurationInput/DistanceInput/the plain number box) can't produce
  // one, but this validator is the real gate, not them.
  if (volumeValue !== null && volumeValue < 0) {
    return { error: `${context} volume value must be zero or greater.` };
  }
  // Digit limit per volume_type — "duration" is DurationInput's own
  // composed whole-seconds count (its own boxes already cap it), so it's
  // skipped here. workout_items.volume_value is numeric(9,2), matching
  // personal_records.value/goals.target_value, so ITEM_CALORIES_DIGIT_LIMIT/
  // ITEM_DISTANCE_DIGIT_LIMIT now share their shape with
  // CALORIES_DIGIT_LIMIT/DISTANCE_DIGIT_LIMIT — kept as their own constants
  // regardless (see lib/numeric-limits.ts's comment) so an unrelated
  // subject's bound can't silently drift this one.
  if (volumeValue !== null && volumeType !== null && volumeType !== "duration") {
    const { limit, label } =
      volumeType === "reps"
        ? { limit: REPS_DIGIT_LIMIT, label: `${context} volume value (reps)` }
        : volumeType === "calories"
          ? { limit: ITEM_CALORIES_DIGIT_LIMIT, label: `${context} volume value (calories)` }
          : { limit: ITEM_DISTANCE_DIGIT_LIMIT, label: `${context} volume value (m)` };
    const digitCheck = checkDigitLimit(volumeValue, limit, label);
    if (!digitCheck.ok) {
      return { error: digitCheck.error };
    }
    volumeValue = digitCheck.value;
  }

  const targetType = parseOptionalEnumValue(
    item.targetType,
    options.targetTypeOptions
  );
  if (targetType === INVALID) {
    return { error: `${context} has an invalid target type.` };
  }

  let targetValue = parseOptionalNumber(item.targetValue);
  if (targetValue === INVALID) {
    return { error: `${context} target value must be a number.` };
  }
  // Range per target_type, checked before the digit-limit pass below —
  // checkDigitLimit only bounds digit *count*, not sign, so -11 (two
  // digits) previously passed it untouched regardless of type. The native
  // number inputs carry matching min/max/step, but noValidate is
  // deliberately set on the builder's <form> (so a required-and-hidden
  // field can't silently block a submit — see WorkoutBuilder's own doc
  // comment), which also disables native min/max enforcement; this
  // validator is what actually gates a submit.
  if (targetValue !== null && targetType === "rpe") {
    if (!Number.isInteger(targetValue) || targetValue < 1 || targetValue > 10) {
      return { error: `${context} RPE must be a whole number from 1 to 10.` };
    }
  }
  if (
    targetValue !== null &&
    (targetType === "pace_500m" || targetType === "pace_km") &&
    targetValue <= 0
  ) {
    // Strictly greater than zero, not >= 0 like the other target types — a
    // pace of zero (zero seconds per 500m/km) isn't a slow pace, it's not a
    // pace at all.
    return { error: `${context} pace must be greater than zero.` };
  }
  if (
    targetValue !== null &&
    (targetType === "cal_per_hour" || targetType === "watts") &&
    targetValue < 0
  ) {
    return { error: `${context} target value must be zero or greater.` };
  }
  // Digit limit per target_type — "rpe" is excluded on purpose: its bound
  // is the fixed 1-10 range checked above, not a digit-count bound, so it
  // never reaches this mechanism. Cal/h and watts share
  // ITEM_TARGET_RATE_DIGIT_LIMIT; both pace types share
  // ITEM_PACE_DIGIT_LIMIT (see lib/numeric-limits.ts for why each is its
  // own constant despite sharing target_value's column).
  if (targetValue !== null && targetType !== null && targetType !== "rpe") {
    const { limit, label } =
      targetType === "cal_per_hour"
        ? { limit: ITEM_TARGET_RATE_DIGIT_LIMIT, label: `${context} target value (cal/h)` }
        : targetType === "watts"
          ? { limit: ITEM_TARGET_RATE_DIGIT_LIMIT, label: `${context} target value (watts)` }
          : { limit: ITEM_PACE_DIGIT_LIMIT, label: `${context} target value (pace)` };
    const digitCheck = checkDigitLimit(targetValue, limit, label);
    if (!digitCheck.ok) {
      return { error: digitCheck.error };
    }
    targetValue = digitCheck.value;
  }

  const targetPreset = parseOptionalEnumValue(
    item.targetPreset,
    options.targetPresetOptions
  );
  if (targetPreset === INVALID) {
    return { error: `${context} has an invalid target preset.` };
  }

  if (targetPreset !== null && (targetType !== null || targetValue !== null)) {
    return {
      error: `${context} cannot have both a target preset and a target type/value.`,
    };
  }

  let weightKg = parseOptionalNumber(item.weightKg);
  if (weightKg === INVALID) {
    return { error: `${context} weight must be a number.` };
  }
  if (weightKg !== null && weightKg < 0) {
    return { error: `${context} weight must be zero or greater.` };
  }
  // Always entered directly in kg (ItemEditor's "Weight in kg" field) —
  // unlike a personal record/goal's weight, there's no unit system to
  // phrase the message in.
  if (weightKg !== null) {
    const digitCheck = checkDigitLimit(
      weightKg,
      LIFTED_WEIGHT_DIGIT_LIMIT,
      `${context} weight (kg)`
    );
    if (!digitCheck.ok) {
      return { error: digitCheck.error };
    }
    weightKg = digitCheck.value;
  }

  const restSeconds = parseOptionalNumber(item.restSeconds);
  if (restSeconds === INVALID) {
    return { error: `${context} rest seconds must be a number.` };
  }
  // >= 0, not > 0 — unlike a block's timing fields, zero rest is a
  // meaningful choice (back-to-back sets), not a missing value.
  if (restSeconds !== null && restSeconds < 0) {
    return { error: `${context} rest must be zero or greater.` };
  }

  const notes =
    typeof item.notes === "string" && item.notes.trim() !== ""
      ? item.notes.trim()
      : null;

  return {
    item: {
      exerciseId,
      customName,
      sets,
      volumeType: volumeType as ValidatedBuilderItem["volumeType"],
      volumeValue,
      targetType: targetType as ValidatedBuilderItem["targetType"],
      targetValue,
      targetPreset: targetPreset as ValidatedBuilderItem["targetPreset"],
      weightKg,
      restSeconds,
      notes,
    },
  };
}

function parseBuilderBlock(
  raw: unknown,
  index: number,
  options: BuilderEnumOptions
): { block: ValidatedBuilderBlock } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: `Block ${index + 1} is invalid.` };
  }
  const block = raw as RawBuilderBlockPayload;

  if (!isOneOf(block.blockType, options.blockTypeOptions)) {
    return { error: `Block ${index + 1} has an invalid block type.` };
  }
  const blockType = block.blockType as ValidatedBuilderBlock["blockType"];

  const title =
    typeof block.title === "string" && block.title.trim() !== ""
      ? block.title.trim()
      : null;

  const durationSeconds = parseOptionalNumber(block.durationSeconds);
  if (durationSeconds === INVALID) {
    return { error: `Block ${index + 1} duration must be a number.` };
  }
  if (durationSeconds !== null && durationSeconds <= 0) {
    return { error: `Block ${index + 1} duration must be positive.` };
  }

  const rounds = parseOptionalNumber(block.rounds);
  if (rounds === INVALID || (rounds !== null && !Number.isInteger(rounds))) {
    return { error: `Block ${index + 1} rounds must be a whole number.` };
  }
  if (rounds !== null && rounds <= 0) {
    return { error: `Block ${index + 1} rounds must be positive.` };
  }

  const workSeconds = parseOptionalNumber(block.workSeconds);
  if (workSeconds === INVALID) {
    return { error: `Block ${index + 1} work seconds must be a number.` };
  }
  if (workSeconds !== null && workSeconds <= 0) {
    return { error: `Block ${index + 1} work time must be positive.` };
  }

  const restSeconds = parseOptionalNumber(block.restSeconds);
  if (restSeconds === INVALID) {
    return { error: `Block ${index + 1} rest seconds must be a number.` };
  }
  if (restSeconds !== null && restSeconds <= 0) {
    return { error: `Block ${index + 1} rest time must be positive.` };
  }

  const intervalSeconds = parseOptionalNumber(block.intervalSeconds);
  if (intervalSeconds === INVALID) {
    return {
      error: `Block ${index + 1} interval seconds must be a number.`,
    };
  }
  if (intervalSeconds !== null && intervalSeconds <= 0) {
    return { error: `Block ${index + 1} interval must be positive.` };
  }

  // Per-block-type required timing fields (GOHYBRID_PLAN.md §5): for_time
  // and general have no required timing fields, so they fall through here
  // untouched. Positivity is already guaranteed by the blanket checks
  // above whenever a field is non-null, so these only need to check for
  // presence — a for_time/general block with a stray zero/negative value
  // in a field it doesn't use (unreachable through the UI, since the
  // reducer clears every timing field on a block_type change, but this
  // validator is the real gate for a direct API call too) is caught above
  // regardless of block type.
  if (blockType === "amrap" && durationSeconds === null) {
    return { error: `Block ${index + 1}: an AMRAP block needs a duration.` };
  }

  if (blockType === "on_off") {
    if (workSeconds === null) {
      return { error: `Block ${index + 1}: an on/off block needs a work time.` };
    }
    if (restSeconds === null) {
      return { error: `Block ${index + 1}: an on/off block needs a rest time.` };
    }
    if (rounds === null) {
      return { error: `Block ${index + 1}: an on/off block needs a number of rounds.` };
    }
  }

  if (blockType === "emom") {
    if (intervalSeconds === null) {
      return { error: `Block ${index + 1}: an EMOM block needs an interval.` };
    }
    if (rounds === null) {
      return { error: `Block ${index + 1}: an EMOM block needs a number of rounds.` };
    }
  }

  const rawItems = Array.isArray(block.items) ? block.items : [];
  const items: ValidatedBuilderItem[] = [];
  for (const [itemIndex, rawItem] of rawItems.entries()) {
    const parsed = parseBuilderItem(
      rawItem,
      options,
      `Block ${index + 1} item ${itemIndex + 1}`
    );
    if ("error" in parsed) {
      return { error: parsed.error };
    }
    items.push(parsed.item);
  }

  return {
    block: {
      title,
      blockType,
      durationSeconds,
      rounds,
      workSeconds,
      restSeconds,
      intervalSeconds,
      items,
    },
  };
}

/**
 * Validates a full workout-builder payload — the workout's own fields
 * plus every block and every item — before it's persisted. Shared by the
 * builder's Save button (client-side, for immediate feedback) and the
 * createFullWorkout Server Action / POST /api/workouts/full Route
 * Handler (server-side, the real gate); the two must never drift apart.
 * Takes the allowed enum values via `options` rather than importing
 * db/schema.ts at runtime, so this function has no Node-only or drizzle
 * dependency and is safe to call from client code.
 *
 * Rules (GOHYBRID_PLAN.md §5): title required and non-empty; primaryType
 * and difficulty must be valid enum values; every block must have a
 * valid blockType; a block's required timing fields depend on its type —
 * amrap needs a positive duration; on_off needs positive work, rest, and
 * rounds; emom needs a positive interval and rounds; for_time and general
 * have none (see parseBuilderBlock) — these fields stay nullable at the
 * DB level (§6) regardless, since this is application-level validation,
 * not a column constraint. Each item must have exactly one of exerciseId
 * or customName (never both, never neither); targetType/targetValue and
 * targetPreset are alternatives, never both; at least one item across
 * the whole workout must have volumeValue or weightKg set — the guard
 * against saving an "empty" workout with no real content. A
 * duration-type volume satisfies this the same way any other volume
 * value does, since duration is represented as volumeType "duration"
 * plus volumeValue, not a separate field. tagIds defaults to an empty
 * array when absent (tags are optional) and each entry must be a
 * syntactically valid UUID, deduplicated rather than rejected.
 */
export function validateBuilderPayload(
  input: RawBuilderPayload,
  options: BuilderEnumOptions
): BuilderValidationResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { success: false, error: "Title is required." };
  }

  if (!isOneOf(input.primaryType, options.primaryTypeOptions)) {
    return {
      success: false,
      error: `primaryType must be one of: ${options.primaryTypeOptions.join(
        ", "
      )}.`,
    };
  }
  const primaryType = input.primaryType;

  if (!isOneOf(input.difficulty, options.difficultyOptions)) {
    return {
      success: false,
      error: `difficulty must be one of: ${options.difficultyOptions.join(
        ", "
      )}.`,
    };
  }
  const difficulty = input.difficulty;

  const description =
    typeof input.description === "string" && input.description.trim() !== ""
      ? input.description.trim()
      : null;

  let estimatedDurationMinutes: number | null = null;
  const rawDuration = input.estimatedDurationMinutes;
  if (rawDuration !== undefined && rawDuration !== null && rawDuration !== "") {
    const parsed =
      typeof rawDuration === "number" ? rawDuration : Number(rawDuration);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return {
        success: false,
        error: "estimatedDurationMinutes must be a positive integer.",
      };
    }
    const digitCheck = checkDigitLimit(
      parsed,
      DURATION_MINUTES_DIGIT_LIMIT,
      "Estimated duration"
    );
    if (!digitCheck.ok) {
      return { success: false, error: digitCheck.error };
    }
    estimatedDurationMinutes = digitCheck.value;
  }

  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  const blocks: ValidatedBuilderBlock[] = [];
  for (const [index, rawBlock] of rawBlocks.entries()) {
    const parsed = parseBuilderBlock(rawBlock, index, options);
    if ("error" in parsed) {
      return { success: false, error: parsed.error };
    }
    blocks.push(parsed.block);
  }

  const hasContent = blocks.some((block) =>
    block.items.some(
      (item) => item.volumeValue !== null || item.weightKg !== null
    )
  );
  if (!hasContent) {
    return {
      success: false,
      error:
        "Add at least one item with a volume or weight filled in — an empty workout can't be saved.",
    };
  }

  const tagIds = parseTagIds(input.tagIds);
  if (tagIds === INVALID) {
    return { success: false, error: "One or more selected tags are invalid." };
  }

  return {
    success: true,
    data: {
      title,
      description,
      primaryType: primaryType as ValidatedBuilderPayload["primaryType"],
      difficulty: difficulty as ValidatedBuilderPayload["difficulty"],
      estimatedDurationMinutes,
      blocks,
      tagIds,
    },
  };
}

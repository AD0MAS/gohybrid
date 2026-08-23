import type {
  blockTypeEnum,
  targetPresetEnum,
  targetTypeEnum,
  volumeTypeEnum,
  workoutDifficultyEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";

// Type-only imports — erased at compile time. This file must have zero
// runtime imports of db/schema.ts (or drizzle-orm), since it's called
// directly from the client-side workout builder for immediate feedback.
// It's kept out of lib/workouts-validation.ts specifically because that
// module has a *runtime* import of db/schema.ts for validateWorkoutInput
// — sharing a file with it would drag drizzle-orm into the client bundle
// the moment the builder imports anything from that module at all.

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
};

function isOneOf(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

/** Distinct from `null` (explicitly "not set") and any real parsed
 * value — signals "the caller provided something, but it's not valid". */
const INVALID = Symbol("invalid");

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

  const volumeValue = parseOptionalNumber(item.volumeValue);
  if (volumeValue === INVALID) {
    return { error: `${context} volume value must be a number.` };
  }

  const targetType = parseOptionalEnumValue(
    item.targetType,
    options.targetTypeOptions
  );
  if (targetType === INVALID) {
    return { error: `${context} has an invalid target type.` };
  }

  const targetValue = parseOptionalNumber(item.targetValue);
  if (targetValue === INVALID) {
    return { error: `${context} target value must be a number.` };
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

  const weightKg = parseOptionalNumber(item.weightKg);
  if (weightKg === INVALID) {
    return { error: `${context} weight must be a number.` };
  }

  const restSeconds = parseOptionalNumber(item.restSeconds);
  if (restSeconds === INVALID) {
    return { error: `${context} rest seconds must be a number.` };
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

  const rounds = parseOptionalNumber(block.rounds);
  if (rounds === INVALID) {
    return { error: `Block ${index + 1} rounds must be a number.` };
  }

  const workSeconds = parseOptionalNumber(block.workSeconds);
  if (workSeconds === INVALID) {
    return { error: `Block ${index + 1} work seconds must be a number.` };
  }

  const restSeconds = parseOptionalNumber(block.restSeconds);
  if (restSeconds === INVALID) {
    return { error: `Block ${index + 1} rest seconds must be a number.` };
  }

  const intervalSeconds = parseOptionalNumber(block.intervalSeconds);
  if (intervalSeconds === INVALID) {
    return {
      error: `Block ${index + 1} interval seconds must be a number.`,
    };
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
 * valid blockType; each item must have exactly one of exerciseId or
 * customName (never both, never neither); targetType/targetValue and
 * targetPreset are alternatives, never both; at least one item across
 * the whole workout must have volumeValue or weightKg set — the guard
 * against saving an "empty" workout with no real content. A
 * duration-type volume satisfies this the same way any other volume
 * value does, since duration is represented as volumeType "duration"
 * plus volumeValue, not a separate field.
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
    estimatedDurationMinutes = parsed;
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

  return {
    success: true,
    data: {
      title,
      description,
      primaryType: primaryType as ValidatedBuilderPayload["primaryType"],
      difficulty: difficulty as ValidatedBuilderPayload["difficulty"],
      estimatedDurationMinutes,
      blocks,
    },
  };
}

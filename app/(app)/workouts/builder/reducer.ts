import type {
  blockTypeEnum,
  exercises,
  tags,
  targetPresetEnum,
  targetTypeEnum,
  volumeTypeEnum,
  workoutDifficultyEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";

// Type-only imports — erased at compile time, so this file never bundles
// drizzle-orm into the client. The actual enum values (and the exercise
// catalog) are passed in as props from the (Server Component) page
// instead.
export type BlockType = (typeof blockTypeEnum.enumValues)[number];
export type PrimaryType = (typeof workoutPrimaryTypeEnum.enumValues)[number];
export type Difficulty = (typeof workoutDifficultyEnum.enumValues)[number];
export type VolumeType = (typeof volumeTypeEnum.enumValues)[number];
export type TargetType = (typeof targetTypeEnum.enumValues)[number];
export type TargetPreset = (typeof targetPresetEnum.enumValues)[number];
export type CatalogExercise = typeof exercises.$inferSelect;
export type CatalogTag = typeof tags.$inferSelect;

export type WorkoutMeta = {
  title: string;
  description: string;
  // "" is the explicit unselected state — the builder starts empty, so
  // these can't just be the enum union on its own.
  primaryType: PrimaryType | "";
  difficulty: Difficulty | "";
  estimatedDurationMinutes: number | null;
  tagIds: string[];
};

/**
 * One item within a block. `exerciseId` and `customName` are mutually
 * exclusive — an item is either linked to a catalog exercise or a
 * free-typed "Quick add" name, never both; the
 * reducer enforces this on every write. `targetType`/`targetValue` and
 * `targetPreset` are likewise alternatives. `id` is a client-only
 * crypto.randomUUID() key, never sent to the database.
 */
export type BuilderItem = {
  id: string;
  exerciseId: string | null;
  customName: string | null;
  sets: number;
  volumeType: VolumeType | "";
  volumeValue: number | null;
  targetType: TargetType | "";
  targetValue: number | null;
  targetPreset: TargetPreset | "";
  weightKg: number | null;
  restSeconds: number | null;
  notes: string;
};

/**
 * One block in the builder. `id` is a crypto.randomUUID() value used only
 * as a stable React key on the client — it is never sent to the database,
 * which generates its own id on save. Timing fields are all stored in
 * seconds regardless of what unit the UI displays them in (block duration
 * is entered in minutes and converted at the input boundary).
 */
export type BuilderBlock = {
  id: string;
  title: string;
  blockType: BlockType;
  durationSeconds: number | null;
  rounds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  intervalSeconds: number | null;
  items: BuilderItem[];
};

export type BuilderState = {
  meta: WorkoutMeta;
  blocks: BuilderBlock[];
};

/**
 * Shape of one item as returned by getWorkoutForUser, restricted to the
 * fields LOAD_WORKOUT reads. `volumeValue`/`targetValue`/`weightKg` are
 * Drizzle `numeric` columns, which come back as strings (or null) rather
 * than numbers.
 */
export type LoadableWorkoutItem = {
  exerciseId: string | null;
  customName: string | null;
  notes: string | null;
  sets: number;
  volumeType: VolumeType | null;
  volumeValue: string | null;
  targetType: TargetType | null;
  targetValue: string | null;
  targetPreset: TargetPreset | null;
  weightKg: string | null;
  restSeconds: number | null;
};

/** Shape of one block as returned by getWorkoutForUser, with its items. */
export type LoadableWorkoutBlock = {
  title: string | null;
  blockType: BlockType;
  durationSeconds: number | null;
  rounds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  intervalSeconds: number | null;
  items: LoadableWorkoutItem[];
};

/** Shape of one workout_tags join row as returned by getWorkoutForUser —
 * only the field LOAD_WORKOUT reads; the nested `tag` object it also
 * carries is ignored here. */
export type LoadableWorkoutTagLink = {
  tagId: string;
};

/**
 * Shape of a workout-with-blocks-items-and-tags as returned by
 * getWorkoutForUser — the input LOAD_WORKOUT converts into BuilderState.
 * Structurally compatible with (but not imported from) that function's
 * return type, so this file keeps its zero-runtime-drizzle-import
 * constraint.
 */
export type LoadableWorkout = {
  title: string;
  description: string | null;
  primaryType: PrimaryType;
  difficulty: Difficulty;
  estimatedDurationMinutes: number | null;
  blocks: LoadableWorkoutBlock[];
  workoutTags: LoadableWorkoutTagLink[];
};

type BlockTimingField =
  | "durationSeconds"
  | "rounds"
  | "workSeconds"
  | "restSeconds"
  | "intervalSeconds";

/** Sets one field of the workout's own metadata. */
type UpdateMetaFieldAction =
  | { type: "UPDATE_META_FIELD"; field: "title" | "description"; value: string }
  | {
      type: "UPDATE_META_FIELD";
      field: "primaryType";
      value: PrimaryType | "";
    }
  | {
      type: "UPDATE_META_FIELD";
      field: "difficulty";
      value: Difficulty | "";
    }
  | {
      type: "UPDATE_META_FIELD";
      field: "estimatedDurationMinutes";
      value: number | null;
    };

/**
 * Appends a new block with default (empty/general) values. `id` is
 * generated by the caller (WorkoutBuilder) rather than inside createBlock,
 * so the caller can know the new block's id in the same tick it dispatches
 * — used to auto-open that block's editor modal (see BlockEditor's
 * `autoOpen` prop).
 */
type AddBlockAction = { type: "ADD_BLOCK"; id: string };

/** Removes one block by its client-side id. */
type RemoveBlockAction = { type: "REMOVE_BLOCK"; blockId: string };

/**
 * Inserts a copy of one block directly after the original, with a fresh
 * crypto.randomUUID() for the block itself and for every item inside it.
 * Generated inside the reducer, not by the caller — unlike AddBlockAction's
 * id, a duplicate's ids are never used to drive autoOpen (a duplicate
 * arrives already configured), and a block duplicate needs an unknown
 * number of item ids, one per item, which the reducer already knows how to
 * mint fresh (see LOAD_WORKOUT below).
 */
type DuplicateBlockAction = { type: "DUPLICATE_BLOCK"; blockId: string };

/**
 * Sets one field of one block. Setting `blockType` also resets every
 * timing field on that block to null, since which fields are valid
 * depends on the new type and stale values from the
 * previous type shouldn't linger.
 */
type UpdateBlockFieldAction =
  | { type: "UPDATE_BLOCK_FIELD"; blockId: string; field: "title"; value: string }
  | {
      type: "UPDATE_BLOCK_FIELD";
      blockId: string;
      field: "blockType";
      value: BlockType;
    }
  | {
      type: "UPDATE_BLOCK_FIELD";
      blockId: string;
      field: BlockTimingField;
      value: number | null;
    };

/**
 * Appends a new (empty) item to a block. `id` is generated by the caller
 * (BlockEditor) rather than inside createItem, so the caller can know the
 * new item's id in the same tick it dispatches — used to auto-open that
 * item's editor modal (see ItemEditor's `autoOpen` prop), mirroring
 * AddBlockAction above.
 */
type AddItemAction = { type: "ADD_ITEM"; blockId: string; id: string };

/** Removes one item from a block by its client-side id. */
type RemoveItemAction = {
  type: "REMOVE_ITEM";
  blockId: string;
  itemId: string;
};

/**
 * Inserts a copy of one item directly after the original, within the same
 * block, with a fresh crypto.randomUUID(). Mirrors DuplicateBlockAction's
 * reducer-side id generation for consistency, even though a single item
 * only ever needs one id.
 */
type DuplicateItemAction = {
  type: "DUPLICATE_ITEM";
  blockId: string;
  itemId: string;
};

/**
 * Sets one field of one item. Setting `exerciseId` clears `customName`
 * and vice versa (they're mutually exclusive). Setting `targetPreset`
 * clears `targetType`/`targetValue`, and setting either of those clears
 * `targetPreset` (alternatives, not both at once).
 */
type UpdateItemFieldAction =
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "exerciseId";
      value: string | null;
    }
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "customName";
      value: string | null;
    }
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "notes";
      value: string;
    }
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "sets";
      value: number;
    }
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "volumeType";
      value: VolumeType | "";
    }
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "volumeValue" | "targetValue" | "weightKg" | "restSeconds";
      value: number | null;
    }
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "targetType";
      value: TargetType | "";
    }
  | {
      type: "UPDATE_ITEM_FIELD";
      blockId: string;
      itemId: string;
      field: "targetPreset";
      value: TargetPreset | "";
    };

/**
 * Replaces the entire builder state with one derived from an existing
 * workout, for the edit builder's initial load. Every block and item gets
 * a fresh crypto.randomUUID() client id — the database ids in `workout`
 * are never carried into builder state (see reducer.ts module docs on
 * block/item identity).
 */
type LoadWorkoutAction = { type: "LOAD_WORKOUT"; workout: LoadableWorkout };

/** Toggles one tag on the workout: adds it to meta.tagIds if absent,
 * removes it if present. Tag ids need no separate identity handling like
 * block/item ids do — they're the database's own tag ids, since the tag
 * catalog is fetched (not created) by the builder. */
type ToggleTagAction = { type: "TOGGLE_TAG"; tagId: string };

export type BuilderAction =
  | UpdateMetaFieldAction
  | AddBlockAction
  | RemoveBlockAction
  | DuplicateBlockAction
  | UpdateBlockFieldAction
  | AddItemAction
  | RemoveItemAction
  | DuplicateItemAction
  | UpdateItemFieldAction
  | LoadWorkoutAction
  | ToggleTagAction;

/** Empty builder state for a brand-new workout. */
export function createInitialBuilderState(): BuilderState {
  return {
    meta: {
      title: "",
      description: "",
      primaryType: "",
      difficulty: "",
      estimatedDurationMinutes: null,
      tagIds: [],
    },
    blocks: [],
  };
}

function createBlock(id: string): BuilderBlock {
  return {
    id,
    title: "",
    blockType: "general",
    durationSeconds: null,
    rounds: null,
    workSeconds: null,
    restSeconds: null,
    intervalSeconds: null,
    items: [],
  };
}

/** Converts a Drizzle `numeric` column's string (or null) to a number
 * (or null), for loading a stored item into builder state. */
function numericStringToNumberOrNull(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function createItem(id: string): BuilderItem {
  return {
    id,
    exerciseId: null,
    customName: null,
    sets: 1,
    volumeType: "",
    volumeValue: null,
    targetType: "",
    targetValue: null,
    targetPreset: "",
    weightKg: null,
    restSeconds: null,
    notes: "",
  };
}

/**
 * Reducer for the workout builder's client-side state. Every operation is
 * a named action; nothing here touches the network or the database — the
 * whole tree lives in memory until the (not-yet-implemented) save step.
 */
export function builderReducer(
  state: BuilderState,
  action: BuilderAction
): BuilderState {
  switch (action.type) {
    case "UPDATE_META_FIELD":
      return {
        ...state,
        meta: { ...state.meta, [action.field]: action.value },
      };

    case "TOGGLE_TAG":
      return {
        ...state,
        meta: {
          ...state.meta,
          tagIds: state.meta.tagIds.includes(action.tagId)
            ? state.meta.tagIds.filter((tagId) => tagId !== action.tagId)
            : [...state.meta.tagIds, action.tagId],
        },
      };

    case "ADD_BLOCK":
      return {
        ...state,
        blocks: [...state.blocks, createBlock(action.id)],
      };

    case "REMOVE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.filter((block) => block.id !== action.blockId),
      };

    case "DUPLICATE_BLOCK": {
      const index = state.blocks.findIndex(
        (block) => block.id === action.blockId
      );
      if (index === -1) return state;

      const original = state.blocks[index];
      const duplicate: BuilderBlock = {
        ...original,
        id: crypto.randomUUID(),
        items: original.items.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
        })),
      };

      return {
        ...state,
        blocks: [
          ...state.blocks.slice(0, index + 1),
          duplicate,
          ...state.blocks.slice(index + 1),
        ],
      };
    }

    case "UPDATE_BLOCK_FIELD":
      return {
        ...state,
        blocks: state.blocks.map((block) => {
          if (block.id !== action.blockId) {
            return block;
          }

          if (action.field === "blockType") {
            return {
              ...block,
              blockType: action.value,
              durationSeconds: null,
              rounds: null,
              workSeconds: null,
              restSeconds: null,
              intervalSeconds: null,
            };
          }

          return { ...block, [action.field]: action.value };
        }),
      };

    case "ADD_ITEM":
      return {
        ...state,
        blocks: state.blocks.map((block) =>
          block.id !== action.blockId
            ? block
            : { ...block, items: [...block.items, createItem(action.id)] }
        ),
      };

    case "REMOVE_ITEM":
      return {
        ...state,
        blocks: state.blocks.map((block) =>
          block.id !== action.blockId
            ? block
            : {
                ...block,
                items: block.items.filter((item) => item.id !== action.itemId),
              }
        ),
      };

    case "DUPLICATE_ITEM":
      return {
        ...state,
        blocks: state.blocks.map((block) => {
          if (block.id !== action.blockId) return block;

          const index = block.items.findIndex(
            (item) => item.id === action.itemId
          );
          if (index === -1) return block;

          const duplicate: BuilderItem = {
            ...block.items[index],
            id: crypto.randomUUID(),
          };

          return {
            ...block,
            items: [
              ...block.items.slice(0, index + 1),
              duplicate,
              ...block.items.slice(index + 1),
            ],
          };
        }),
      };

    case "UPDATE_ITEM_FIELD":
      return {
        ...state,
        blocks: state.blocks.map((block) => {
          if (block.id !== action.blockId) {
            return block;
          }

          return {
            ...block,
            items: block.items.map((item) => {
              if (item.id !== action.itemId) {
                return item;
              }

              switch (action.field) {
                case "exerciseId":
                  return {
                    ...item,
                    exerciseId: action.value,
                    customName: null,
                  };
                case "customName":
                  return {
                    ...item,
                    customName: action.value,
                    exerciseId: null,
                  };
                case "volumeType":
                  // A stored volumeValue means something different per
                  // volumeType (seconds, metres, reps, kcal) — carrying it
                  // across a type change would silently reinterpret it.
                  return {
                    ...item,
                    volumeType: action.value,
                    volumeValue: null,
                  };
                case "targetPreset":
                  return {
                    ...item,
                    targetPreset: action.value,
                    targetType: "",
                    targetValue: null,
                  };
                case "targetType":
                  // A stored targetValue means something different per
                  // targetType (pace_500m, cal_per_hour, watts, rpe) — same
                  // reasoning as volumeType above, carrying it across a type
                  // change would silently reinterpret it.
                  return {
                    ...item,
                    targetType: action.value,
                    targetPreset: "",
                    targetValue: null,
                  };
                case "targetValue":
                  return {
                    ...item,
                    targetValue: action.value,
                    targetPreset: "",
                  };
                default:
                  return { ...item, [action.field]: action.value };
              }
            }),
          };
        }),
      };

    case "LOAD_WORKOUT":
      return {
        meta: {
          title: action.workout.title,
          description: action.workout.description ?? "",
          primaryType: action.workout.primaryType,
          difficulty: action.workout.difficulty,
          estimatedDurationMinutes: action.workout.estimatedDurationMinutes,
          tagIds: action.workout.workoutTags.map((link) => link.tagId),
        },
        blocks: action.workout.blocks.map((block) => ({
          id: crypto.randomUUID(),
          title: block.title ?? "",
          blockType: block.blockType,
          durationSeconds: block.durationSeconds,
          rounds: block.rounds,
          workSeconds: block.workSeconds,
          restSeconds: block.restSeconds,
          intervalSeconds: block.intervalSeconds,
          items: block.items.map((item) => ({
            id: crypto.randomUUID(),
            exerciseId: item.exerciseId,
            customName: item.customName,
            sets: item.sets,
            volumeType: item.volumeType ?? "",
            volumeValue: numericStringToNumberOrNull(item.volumeValue),
            targetType: item.targetType ?? "",
            targetValue: numericStringToNumberOrNull(item.targetValue),
            targetPreset: item.targetPreset ?? "",
            weightKg: numericStringToNumberOrNull(item.weightKg),
            restSeconds: item.restSeconds,
            notes: item.notes ?? "",
          })),
        })),
      };

    default:
      return state;
  }
}

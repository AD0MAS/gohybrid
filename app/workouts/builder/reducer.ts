import type {
  blockTypeEnum,
  exercises,
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

export type WorkoutMeta = {
  title: string;
  description: string;
  // "" is the explicit unselected state — the builder starts empty, so
  // these can't just be the enum union on its own.
  primaryType: PrimaryType | "";
  difficulty: Difficulty | "";
  estimatedDurationMinutes: number | null;
};

/**
 * One item within a block. `exerciseId` and `customName` are mutually
 * exclusive — an item is either linked to a catalog exercise or a
 * free-typed "Quick add" name (GOHYBRID_PLAN.md §5), never both; the
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

/** Appends a new block with default (empty/general) values. */
type AddBlockAction = { type: "ADD_BLOCK" };

/** Removes one block by its client-side id. */
type RemoveBlockAction = { type: "REMOVE_BLOCK"; blockId: string };

/**
 * Sets one field of one block. Setting `blockType` also resets every
 * timing field on that block to null, since which fields are valid
 * depends on the new type (GOHYBRID_PLAN.md §5) and stale values from the
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

/** Appends a new (empty) item to a block. */
type AddItemAction = { type: "ADD_ITEM"; blockId: string };

/** Removes one item from a block by its client-side id. */
type RemoveItemAction = {
  type: "REMOVE_ITEM";
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

export type BuilderAction =
  | UpdateMetaFieldAction
  | AddBlockAction
  | RemoveBlockAction
  | UpdateBlockFieldAction
  | AddItemAction
  | RemoveItemAction
  | UpdateItemFieldAction;

/** Empty builder state for a brand-new workout. */
export function createInitialBuilderState(): BuilderState {
  return {
    meta: {
      title: "",
      description: "",
      primaryType: "",
      difficulty: "",
      estimatedDurationMinutes: null,
    },
    blocks: [],
  };
}

function createBlock(): BuilderBlock {
  return {
    id: crypto.randomUUID(),
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

function createItem(): BuilderItem {
  return {
    id: crypto.randomUUID(),
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

    case "ADD_BLOCK":
      return {
        ...state,
        blocks: [...state.blocks, createBlock()],
      };

    case "REMOVE_BLOCK":
      return {
        ...state,
        blocks: state.blocks.filter((block) => block.id !== action.blockId),
      };

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
            : { ...block, items: [...block.items, createItem()] }
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
                case "targetPreset":
                  return {
                    ...item,
                    targetPreset: action.value,
                    targetType: "",
                    targetValue: null,
                  };
                case "targetType":
                  return { ...item, targetType: action.value, targetPreset: "" };
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

    default:
      return state;
  }
}

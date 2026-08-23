import type {
  blockTypeEnum,
  workoutDifficultyEnum,
  workoutPrimaryTypeEnum,
} from "@/db/schema";

// Type-only imports — erased at compile time, so this file never bundles
// drizzle-orm into the client. The actual enum values are passed in as
// props from the (Server Component) page instead.
export type BlockType = (typeof blockTypeEnum.enumValues)[number];
export type PrimaryType = (typeof workoutPrimaryTypeEnum.enumValues)[number];
export type Difficulty = (typeof workoutDifficultyEnum.enumValues)[number];

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

export type BuilderAction =
  | UpdateMetaFieldAction
  | AddBlockAction
  | RemoveBlockAction
  | UpdateBlockFieldAction;

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

    default:
      return state;
  }
}

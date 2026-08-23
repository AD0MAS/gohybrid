"use client";

import { useReducer } from "react";
import BlockEditor from "./BlockEditor";
import {
  builderReducer,
  createInitialBuilderState,
  type BlockType,
  type Difficulty,
  type PrimaryType,
} from "./reducer";

type WorkoutBuilderProps = {
  primaryTypeOptions: readonly PrimaryType[];
  difficultyOptions: readonly Difficulty[];
  blockTypeOptions: readonly BlockType[];
};

/**
 * Client-side workout builder: workout meta fields, then a list of
 * blocks with add/remove controls. The whole tree lives in useReducer
 * state until Save is implemented in a later step — for now Save only
 * logs the current state to the console. Enum option lists are passed in
 * as props from the (Server Component) page rather than imported here,
 * so this file never bundles drizzle-orm into the client. This is the
 * single "use client" boundary for the builder; BlockEditor is a plain
 * function component rendered from here, not its own client boundary.
 */
export default function WorkoutBuilder({
  primaryTypeOptions,
  difficultyOptions,
  blockTypeOptions,
}: WorkoutBuilderProps) {
  const [state, dispatch] = useReducer(
    builderReducer,
    undefined,
    createInitialBuilderState
  );

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="font-medium">Workout</legend>

        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            type="text"
            required
            value={state.meta.title}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "title",
                value: e.target.value,
              })
            }
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            value={state.meta.description}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "description",
                value: e.target.value,
              })
            }
            className="rounded border border-gray-300 p-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Primary type
          <select
            required
            value={state.meta.primaryType}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "primaryType",
                value: e.target.value as PrimaryType | "",
              })
            }
            className="rounded border border-gray-300 p-2"
          >
            <option value="" disabled>
              Select a type
            </option>
            {primaryTypeOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Difficulty
          <select
            required
            value={state.meta.difficulty}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "difficulty",
                value: e.target.value as Difficulty | "",
              })
            }
            className="rounded border border-gray-300 p-2"
          >
            <option value="" disabled>
              Select a difficulty
            </option>
            {difficultyOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Estimated duration in minutes
          <input
            type="number"
            min={1}
            step={1}
            value={state.meta.estimatedDurationMinutes ?? ""}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_META_FIELD",
                field: "estimatedDurationMinutes",
                value: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="rounded border border-gray-300 p-2"
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-medium">Blocks</legend>

        {state.blocks.length === 0 ? (
          <p className="text-sm text-gray-600">No blocks yet.</p>
        ) : (
          state.blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              index={index}
              blockTypeOptions={blockTypeOptions}
              dispatch={dispatch}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => dispatch({ type: "ADD_BLOCK" })}
          className="self-start rounded border border-gray-300 px-3 py-2 text-sm"
        >
          Add block
        </button>
      </fieldset>

      <button
        type="button"
        onClick={() => console.log(state)}
        className="self-start rounded bg-black px-4 py-2 text-sm text-white"
      >
        Save
      </button>
    </div>
  );
}

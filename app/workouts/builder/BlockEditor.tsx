import type { Dispatch } from "react";
import type { BlockType, BuilderAction, BuilderBlock } from "./reducer";

type BlockEditorProps = {
  block: BuilderBlock;
  index: number;
  blockTypeOptions: readonly BlockType[];
  dispatch: Dispatch<BuilderAction>;
};

/**
 * Editor for a single block: an optional title, the block_type select,
 * and only the timing fields relevant to the selected type, per the
 * table in GOHYBRID_PLAN.md §5:
 *   for_time — duration (optional), rounds (optional)
 *   on_off   — work seconds, rest seconds, rounds (all required)
 *   amrap    — duration (required)
 *   emom     — interval seconds, rounds (both required; no duration)
 *   general  — no timing fields
 * Block duration is entered in minutes and converted to/from seconds at
 * this component's input boundary; work, rest, and interval are entered
 * directly in seconds, which is how athletes actually think about them.
 * Not a "use client" file itself — it's only ever rendered from
 * WorkoutBuilder, which owns the single client boundary for the builder.
 */
export default function BlockEditor({
  block,
  index,
  blockTypeOptions,
  dispatch,
}: BlockEditorProps) {
  const durationMinutes =
    block.durationSeconds != null ? block.durationSeconds / 60 : "";

  return (
    <fieldset className="flex flex-col gap-3 rounded border border-gray-300 p-3">
      <legend className="text-sm font-medium">Block {index + 1}</legend>

      <label className="flex flex-col gap-1 text-sm">
        Title (optional)
        <input
          type="text"
          value={block.title}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_BLOCK_FIELD",
              blockId: block.id,
              field: "title",
              value: e.target.value,
            })
          }
          className="rounded border border-gray-300 p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Block type
        <select
          value={block.blockType}
          onChange={(e) =>
            dispatch({
              type: "UPDATE_BLOCK_FIELD",
              blockId: block.id,
              field: "blockType",
              value: e.target.value as BlockType,
            })
          }
          className="rounded border border-gray-300 p-2"
        >
          {blockTypeOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      {(block.blockType === "for_time" || block.blockType === "amrap") && (
        <label className="flex flex-col gap-1 text-sm">
          Duration in minutes
          {block.blockType === "for_time" ? " (optional)" : ""}
          <input
            type="number"
            min={1}
            step={1}
            required={block.blockType === "amrap"}
            value={durationMinutes}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_BLOCK_FIELD",
                blockId: block.id,
                field: "durationSeconds",
                value:
                  e.target.value === "" ? null : Number(e.target.value) * 60,
              })
            }
            className="rounded border border-gray-300 p-2"
          />
        </label>
      )}

      {(block.blockType === "for_time" ||
        block.blockType === "on_off" ||
        block.blockType === "emom") && (
        <label className="flex flex-col gap-1 text-sm">
          Rounds
          {block.blockType === "for_time" ? " (optional)" : ""}
          <input
            type="number"
            min={1}
            step={1}
            required={block.blockType === "on_off" || block.blockType === "emom"}
            value={block.rounds ?? ""}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_BLOCK_FIELD",
                blockId: block.id,
                field: "rounds",
                value: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="rounded border border-gray-300 p-2"
          />
        </label>
      )}

      {block.blockType === "on_off" && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Work in seconds
            <input
              type="number"
              min={1}
              step={1}
              required
              value={block.workSeconds ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_BLOCK_FIELD",
                  blockId: block.id,
                  field: "workSeconds",
                  value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="rounded border border-gray-300 p-2"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Rest in seconds
            <input
              type="number"
              min={1}
              step={1}
              required
              value={block.restSeconds ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_BLOCK_FIELD",
                  blockId: block.id,
                  field: "restSeconds",
                  value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="rounded border border-gray-300 p-2"
            />
          </label>
        </>
      )}

      {block.blockType === "emom" && (
        <label className="flex flex-col gap-1 text-sm">
          Interval in seconds
          <input
            type="number"
            min={1}
            step={1}
            required
            value={block.intervalSeconds ?? ""}
            onChange={(e) =>
              dispatch({
                type: "UPDATE_BLOCK_FIELD",
                blockId: block.id,
                field: "intervalSeconds",
                value: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="rounded border border-gray-300 p-2"
          />
        </label>
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: "REMOVE_BLOCK", blockId: block.id })}
        className="self-start text-sm text-red-700 underline"
      >
        Remove block
      </button>
    </fieldset>
  );
}

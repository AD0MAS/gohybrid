import type { Dispatch } from "react";
import ItemEditor from "./ItemEditor";
import type {
  BlockType,
  BuilderAction,
  BuilderBlock,
  CatalogExercise,
  TargetPreset,
  TargetType,
  VolumeType,
} from "./reducer";

type BlockEditorProps = {
  block: BuilderBlock;
  index: number;
  blockTypeOptions: readonly BlockType[];
  catalog: readonly CatalogExercise[];
  volumeTypeOptions: readonly VolumeType[];
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
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
  catalog,
  volumeTypeOptions,
  targetTypeOptions,
  targetPresetOptions,
  dispatch,
}: BlockEditorProps) {
  // Rounded rather than divided outright: a loaded workout's
  // durationSeconds isn't guaranteed to be a multiple of 60 (e.g. seeded
  // or API-written data), and this input is whole minutes only. Rounding
  // only affects display — the underlying durationSeconds is left as-is
  // in state unless this field is actually edited, which re-derives it
  // as value * 60.
  const durationMinutes =
    block.durationSeconds != null
      ? Math.round(block.durationSeconds / 60)
      : "";

  return (
    <div className="flex flex-col gap-3 rounded border border-hairline bg-surface-1 p-5">
      <p className="text-sm font-medium">Block {index + 1}</p>

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
          className="rounded border border-hairline bg-surface-1 p-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
          className="rounded border border-hairline bg-surface-1 p-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
            className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
            className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
              className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
              className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
            className="h-11 rounded border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
        </label>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Items</p>

        {block.items.length === 0 ? (
          <p className="text-sm text-ink-subtle">No items yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {block.items.map((item, itemIndex) => (
              <ItemEditor
                key={item.id}
                blockId={block.id}
                item={item}
                index={itemIndex}
                catalog={catalog}
                volumeTypeOptions={volumeTypeOptions}
                targetTypeOptions={targetTypeOptions}
                targetPresetOptions={targetPresetOptions}
                dispatch={dispatch}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => dispatch({ type: "ADD_ITEM", blockId: block.id })}
          className="flex h-11 items-center justify-center self-start rounded border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Add item
        </button>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: "REMOVE_BLOCK", blockId: block.id })}
        className="self-start text-sm text-ink-subtle underline hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        Remove block
      </button>
    </div>
  );
}

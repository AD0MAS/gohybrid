import { useState, type Dispatch } from "react";
import { Pencil, X } from "lucide-react";
import type { unitSystemEnum } from "@/db/schema";
import { REPS_DIGIT_LIMIT } from "@/lib/numeric-limits";
import { formatDurationSeconds } from "@/lib/units";
import DurationInput from "../../_components/DurationInput";
import Modal from "../../_components/Modal";
import { BLOCK_TYPE_LABELS } from "./block-type-labels";
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
import {
  numberInputGuardProps,
  sanitizeNumberInputChange,
} from "../../_components/sanitize-live-number";

type BlockEditorProps = {
  block: BuilderBlock;
  index: number;
  /** True only for the block just created by this render of ADD_BLOCK
   * (see WorkoutBuilder's `lastAddedBlockId`) — seeds `open`'s initial
   * value so the type choice is presented the moment a block is added.
   * Read once, at mount, not synced: reopening later via Configure is
   * entirely under the user's own control. */
  autoOpen: boolean;
  blockTypeOptions: readonly BlockType[];
  catalog: readonly CatalogExercise[];
  volumeTypeOptions: readonly VolumeType[];
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  unitSystem: (typeof unitSystemEnum.enumValues)[number];
  dispatch: Dispatch<BuilderAction>;
};

/**
 * One-line rendering of a block's timing fields, per block_type, in the
 * same units DurationInput edits them in (formatDurationSeconds — the same
 * helper the read-only workout detail page uses for this). Returns null
 * when the type has no timing fields (general) or none are filled in yet,
 * so the summary row can omit the " · " separator entirely.
 */
function formatBlockTiming(block: BuilderBlock): string | null {
  switch (block.blockType) {
    case "for_time": {
      const parts = [
        block.durationSeconds != null && formatDurationSeconds(block.durationSeconds),
        block.rounds != null && `${block.rounds} rounds`,
      ].filter((part): part is string => Boolean(part));
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case "amrap":
      return block.durationSeconds != null
        ? formatDurationSeconds(block.durationSeconds)
        : null;
    case "on_off":
      if (
        block.workSeconds == null ||
        block.restSeconds == null ||
        block.rounds == null
      ) {
        return null;
      }
      return `${formatDurationSeconds(block.workSeconds)} on / ${formatDurationSeconds(block.restSeconds)} off × ${block.rounds}`;
    case "emom":
      if (block.intervalSeconds == null || block.rounds == null) return null;
      return `${formatDurationSeconds(block.intervalSeconds)} × ${block.rounds}`;
    case "general":
      return null;
  }
}

/**
 * Editor for a single block: the summary row (title, block type label,
 * timing summary) always shown on the builder page, plus a Configure
 * control opening a Modal with the full editor — an optional title, the
 * block_type select, and only the timing fields relevant to the selected
 * type, per the table in GOHYBRID_PLAN.md §5:
 *   for_time — duration (optional), rounds (optional)
 *   on_off   — work seconds, rest seconds, rounds (all required)
 *   amrap    — duration (required)
 *   emom     — interval seconds, rounds (both required; no duration)
 *   general  — no timing fields
 * Every timing field is entered through DurationInput as h:mm:ss or mm:ss
 * boxes and stored as seconds either way. Each one is keyed on
 * block.blockType: switching type resets every timing field to null
 * (reducer.ts), but a compatible transition (e.g. for_time -> amrap) keeps
 * the same field visible at the same position in the tree, so without the
 * key DurationInput's own local box state would survive the reset and
 * keep showing the stale value. The key forces a fresh instance whenever
 * that reset happens.
 *
 * No modal-reopen remount trick (see the /profile field components' `key=
 * {formKey}` pattern): every field inside the modal is controlled straight
 * off `block` (reducer state) and dispatches straight back to it, so there
 * is no local state that could go stale between closing and reopening —
 * unlike the /profile forms, which seed local state once from `entry`.
 * Changes dispatch immediately; there is no save/cancel inside the modal,
 * the builder's Save button is still the only commit point — the modal's
 * Done button, the last element inside its content (Modal itself has no
 * footer slot — see Modal's own doc comment), only calls setOpen(false),
 * same as the close X.
 *
 * `open`'s initial value comes from `autoOpen` (useState(autoOpen), not a
 * synced value) — true for the block WorkoutBuilder just created via
 * ADD_BLOCK, so its type choice is presented immediately instead of
 * defaulting to "general" unseen. Closing without changing anything still
 * leaves it "general" — a valid, no-fields-required type per §5 — the goal
 * is that the choice was seen, not that one was forced.
 *
 * Not a "use client" file itself — it's only ever rendered from
 * WorkoutBuilder, which owns the single client boundary for the builder.
 * The local `open` state here doesn't require its own directive: this
 * module is already part of that client bundle by virtue of being
 * imported from it.
 */
export default function BlockEditor({
  block,
  index,
  autoOpen,
  blockTypeOptions,
  catalog,
  volumeTypeOptions,
  targetTypeOptions,
  targetPresetOptions,
  unitSystem,
  dispatch,
}: BlockEditorProps) {
  const [open, setOpen] = useState(autoOpen);
  /** The most recently ADD_ITEM-ed item's id within this block, so that
   * item's ItemEditor can auto-open its modal once. Scoped per block
   * (rather than lifted to WorkoutBuilder, the way lastAddedBlockId is) so
   * an id can never match an item in a different block and auto-open the
   * wrong modal. Generated here (not by the reducer) so it's known in the
   * same tick as the dispatch — see AddItemAction's doc comment in
   * reducer.ts. */
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const timing = formatBlockTiming(block);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {block.title || `Block ${index + 1}`}
          </p>
          <p className="text-sm text-ink-subtle">
            {BLOCK_TYPE_LABELS[block.blockType].label}
            {timing ? ` · ${timing}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Configure"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "REMOVE_BLOCK", blockId: block.id })}
            aria-label="Remove block"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={block.title || `Block ${index + 1}`}
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Title <span className="text-xs text-ink-subtle">(optional)</span>
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
              className="rounded-md border border-hairline bg-surface-1 p-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
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
              className="rounded-md border border-hairline bg-surface-1 p-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
            >
              {blockTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {BLOCK_TYPE_LABELS[value].label}
                </option>
              ))}
            </select>
          </label>

          {(block.blockType === "for_time" || block.blockType === "amrap") && (
            <label className="flex flex-col gap-1 text-sm">
              Duration{" "}
              {block.blockType === "for_time" && (
                <span className="text-xs text-ink-subtle">(optional)</span>
              )}
              <DurationInput
                key={block.blockType}
                maxUnit="hours"
                valueSeconds={block.durationSeconds}
                onChange={(value) =>
                  dispatch({
                    type: "UPDATE_BLOCK_FIELD",
                    blockId: block.id,
                    field: "durationSeconds",
                    value,
                  })
                }
              />
            </label>
          )}

          {(block.blockType === "for_time" ||
            block.blockType === "on_off" ||
            block.blockType === "emom") && (
            <label className="flex flex-col gap-1 text-sm">
              Rounds{" "}
              {block.blockType === "for_time" && (
                <span className="text-xs text-ink-subtle">(optional)</span>
              )}
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
                    // No dedicated Rounds constant in lib/numeric-limits.ts —
                    // same reuse of REPS_DIGIT_LIMIT as ItemEditor's Sets
                    // field, for the same reason (a plain whole-number
                    // count with no constant of its own).
                    value: sanitizeNumberInputChange(e, {
                      min: 1,
                      digitLimit: REPS_DIGIT_LIMIT,
                    }),
                  })
                }
                {...numberInputGuardProps()}
                className="h-11 rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              />
            </label>
          )}

          {block.blockType === "on_off" && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                Work
                <DurationInput
                  key={block.blockType}
                  maxUnit="minutes"
                  valueSeconds={block.workSeconds}
                  onChange={(value) =>
                    dispatch({
                      type: "UPDATE_BLOCK_FIELD",
                      blockId: block.id,
                      field: "workSeconds",
                      value,
                    })
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Rest
                <DurationInput
                  key={block.blockType}
                  maxUnit="minutes"
                  valueSeconds={block.restSeconds}
                  onChange={(value) =>
                    dispatch({
                      type: "UPDATE_BLOCK_FIELD",
                      blockId: block.id,
                      field: "restSeconds",
                      value,
                    })
                  }
                />
              </label>
            </>
          )}

          {block.blockType === "emom" && (
            <label className="flex flex-col gap-1 text-sm">
              Interval
              <DurationInput
                key={block.blockType}
                maxUnit="minutes"
                valueSeconds={block.intervalSeconds}
                onChange={(value) =>
                  dispatch({
                    type: "UPDATE_BLOCK_FIELD",
                    blockId: block.id,
                    field: "intervalSeconds",
                    value,
                  })
                }
              />
            </label>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base text-white hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            Done
          </button>
        </div>
      </Modal>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Items</p>

        {block.items.length === 0 ? (
          <p className="text-sm text-ink-subtle">No items yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {block.items.map((item) => (
              <ItemEditor
                key={item.id}
                blockId={block.id}
                item={item}
                autoOpen={item.id === lastAddedItemId}
                catalog={catalog}
                volumeTypeOptions={volumeTypeOptions}
                targetTypeOptions={targetTypeOptions}
                targetPresetOptions={targetPresetOptions}
                unitSystem={unitSystem}
                dispatch={dispatch}
              />
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID();
            setLastAddedItemId(id);
            dispatch({ type: "ADD_ITEM", blockId: block.id, id });
          }}
          className="flex h-11 items-center justify-center self-start rounded-md border border-hairline bg-surface-1 px-4 text-base text-ink hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Add item
        </button>
      </div>
    </div>
  );
}

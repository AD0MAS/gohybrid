import { useRef, useState, type Dispatch } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Pencil, X } from "lucide-react";
import type { unitSystemEnum } from "@/db/schema";
import { ROUNDS_DIGIT_LIMIT } from "@/lib/numeric-limits";
import { NAME_MAX_LENGTH } from "@/lib/text-limits";
import {
  validateBuilderBlockDraft,
  type BuilderBlockDraftErrors,
} from "@/lib/workout-builder-validation";
import { formatBlockSummary } from "@/lib/workout-summary";
import CardMenu, {
  MENU_ITEM_CLASSES,
  MENU_ITEM_DANGER_CLASSES,
} from "../../_components/CardMenu";
import DurationInput from "../../_components/DurationInput";
import Modal from "../../_components/Modal";
import { BLOCK_TYPE_LABELS } from "./block-type-labels";
import { ADD_BUTTON_TEXT_CLASSES } from "./add-button-classes";
import DragHandle from "./DragHandle";
import type { BuilderSortableData } from "./dnd";
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

const BLOCK_SUMMARY_LABELS = { blockType: BLOCK_TYPE_LABELS };

const ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
const DANGER_ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-3 hover:text-danger active:bg-surface-3 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
const ADD_ITEM_CLASSES =
  `flex h-10 items-center justify-center rounded-control border border-hairline bg-surface-3 ${ADD_BUTTON_TEXT_CLASSES} hover:border-hairline-strong active:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus`;

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

/** The draft BlockEditorModalFields edits: title and the five timing
 * fields, plus blockType — everything the modal's Save button commits to
 * the reducer in one go. Kept separate from BuilderBlock (rather than
 * reused directly) so it's obvious at a glance which fields the modal
 * actually owns — items aren't part of it. */
type BlockDraft = {
  title: string;
  blockType: BlockType;
  durationSeconds: number | null;
  rounds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  intervalSeconds: number | null;
};

function draftFromBlock(block: BuilderBlock): BlockDraft {
  return {
    title: block.title,
    blockType: block.blockType,
    durationSeconds: block.durationSeconds,
    rounds: block.rounds,
    workSeconds: block.workSeconds,
    restSeconds: block.restSeconds,
    intervalSeconds: block.intervalSeconds,
  };
}

/**
 * Editor for a single block: a sortable card (drag handle, title, a summary
 * line with the type label, timing and item count, and edit/duplicate/remove
 * controls) holding its items, plus a Modal with the full editor — an
 * optional title, the block_type select, and only the timing fields relevant
 * to the selected type, per block type:
 *   for_time — duration (optional), rounds (optional)
 *   on_off   — work seconds, rest seconds, rounds (all required)
 *   amrap    — duration (required)
 *   emom     — interval seconds, rounds (both required; no duration)
 *   general  — no timing fields
 * Every timing field is entered through DurationInput as h:mm:ss or mm:ss
 * boxes and stored as seconds either way. The summary line comes from
 * formatBlockSummary (lib/workout-summary.ts), the same wording the workout
 * detail page uses for block timing.
 *
 * From sm the three controls are icon buttons; below sm they collapse into
 * one CardMenu (the same three-dot menu Home and /profile use).
 *
 * The modal is a draft, not a live view of the reducer: BlockEditorModalFields
 * (below) holds its own title/blockType/timing-field state, seeded from
 * `block` fresh on every open — remounted via `key={openCount}`, the same
 * remount idiom the /profile field components use (`key={formKey}`) to
 * force every one of a component's useState initializers to re-run from
 * source data rather than resetting each piece of state by hand. Fields
 * inside the modal read and write that local draft; nothing dispatches
 * until Save. Closing via the X, Esc, or a backdrop click (Modal's single
 * onClose, fired for all three — see Modal's own doc comment) discards the
 * draft outright; for a block that autoOpen just created and that has
 * never been saved even once, it also REMOVE_BLOCKs the block itself, so
 * an abandoned brand-new block doesn't linger in "general" with nothing
 * configured. `wasAutoCreated` captures `autoOpen` once at mount (mirroring
 * `open`'s own `useState(autoOpen)`) rather than reading the prop live,
 * since WorkoutBuilder clears `lastAddedBlockId` after use — reading
 * `autoOpen` directly at close time would then see `false` even for the
 * block that really was just auto-created. `hasSavedRef` doesn't need to
 * be state: it's only ever read inside the close handler, an event, never
 * during render.
 *
 * Not a "use client" file itself — it's only ever rendered from
 * WorkoutBuilder, which owns the single client boundary for the builder.
 * The local state here doesn't require its own directive: this module is
 * already part of that client bundle by virtue of being imported from it.
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
  const [wasAutoCreated] = useState(autoOpen);
  const [open, setOpen] = useState(autoOpen);
  const [openCount, setOpenCount] = useState(0);
  const hasSavedRef = useRef(false);
  /** The most recently ADD_ITEM-ed item's id within this block, so that
   * item's ItemEditor can auto-open its modal once. Scoped per block
   * (rather than lifted to WorkoutBuilder, the way lastAddedBlockId is) so
   * an id can never match an item in a different block and auto-open the
   * wrong modal. Generated here (not by the reducer) so it's known in the
   * same tick as the dispatch — see AddItemAction's doc comment in
   * reducer.ts. */
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const summary = formatBlockSummary(
    block,
    block.items.length,
    BLOCK_SUMMARY_LABELS
  );
  const displayTitle = block.title || `Block ${index + 1}`;

  const sortableData: BuilderSortableData = { type: "block" };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, data: sortableData });

  function openFresh() {
    setOpenCount((count) => count + 1);
    setOpen(true);
  }

  function duplicate() {
    dispatch({ type: "DUPLICATE_BLOCK", blockId: block.id });
  }

  function remove() {
    dispatch({ type: "REMOVE_BLOCK", blockId: block.id });
  }

  function handleModalClose() {
    setOpen(false);
    if (wasAutoCreated && !hasSavedRef.current) {
      dispatch({ type: "REMOVE_BLOCK", blockId: block.id });
    }
  }

  /** Save: commits every field of the draft to the reducer in one batch —
   * blockType first (UPDATE_BLOCK_FIELD resets all five timing fields to
   * null whenever that field is set, regardless of whether the value
   * actually changed — see reducer.ts), then every timing field from the
   * draft, which reconstructs exactly what the draft held even when
   * blockType itself didn't change. Marking `hasSavedRef` before closing
   * means a later cancel (reopening via Configure, then closing without
   * saving again) no longer removes the block. */
  function handleSave(draft: BlockDraft) {
    dispatch({ type: "UPDATE_BLOCK_FIELD", blockId: block.id, field: "title", value: draft.title });
    dispatch({ type: "UPDATE_BLOCK_FIELD", blockId: block.id, field: "blockType", value: draft.blockType });
    dispatch({ type: "UPDATE_BLOCK_FIELD", blockId: block.id, field: "durationSeconds", value: draft.durationSeconds });
    dispatch({ type: "UPDATE_BLOCK_FIELD", blockId: block.id, field: "rounds", value: draft.rounds });
    dispatch({ type: "UPDATE_BLOCK_FIELD", blockId: block.id, field: "workSeconds", value: draft.workSeconds });
    dispatch({ type: "UPDATE_BLOCK_FIELD", blockId: block.id, field: "restSeconds", value: draft.restSeconds });
    dispatch({ type: "UPDATE_BLOCK_FIELD", blockId: block.id, field: "intervalSeconds", value: draft.intervalSeconds });
    dispatch({ type: "CONFIRM_BLOCK", blockId: block.id });
    hasSavedRef.current = true;
    setOpen(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex min-w-0 flex-col gap-3 rounded-card border border-hairline bg-surface-2 p-4 ${
        isDragging ? "relative z-10 opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <DragHandle
            label="Reorder block"
            setActivatorNodeRef={setActivatorNodeRef}
            attributes={attributes}
            listeners={listeners}
          />
          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <p className="break-words text-sm font-medium text-ink">
              {displayTitle}
            </p>
            <p className="break-words text-xs text-ink-tertiary">{summary}</p>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={openFresh}
            aria-label="Configure"
            className={ICON_BUTTON_CLASSES}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={duplicate}
            aria-label="Duplicate block"
            className={ICON_BUTTON_CLASSES}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={remove}
            aria-label="Remove block"
            className={DANGER_ICON_BUTTON_CLASSES}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="shrink-0 sm:hidden">
          <CardMenu>
            <button type="button" onClick={openFresh} className={MENU_ITEM_CLASSES}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </button>
            <button type="button" onClick={duplicate} className={MENU_ITEM_CLASSES}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Duplicate
            </button>
            <button type="button" onClick={remove} className={MENU_ITEM_DANGER_CLASSES}>
              <X className="h-4 w-4" aria-hidden="true" />
              Delete
            </button>
          </CardMenu>
        </div>
      </div>

      <Modal open={open} onClose={handleModalClose} title={displayTitle}>
        <BlockEditorModalFields
          key={openCount}
          block={block}
          blockTypeOptions={blockTypeOptions}
          onSave={handleSave}
        />
      </Modal>

      <div className="flex flex-col gap-2">
        {block.items.length === 0 ? (
          <p className="text-xs text-ink-tertiary">No items yet.</p>
        ) : (
          <SortableContext
            items={block.items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
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
          </SortableContext>
        )}

        <button
          type="button"
          onClick={() => {
            const id = crypto.randomUUID();
            setLastAddedItemId(id);
            dispatch({ type: "ADD_ITEM", blockId: block.id, id });
          }}
          className={ADD_ITEM_CLASSES}
        >
          Add item
        </button>
      </div>
    </div>
  );
}

type BlockEditorModalFieldsProps = {
  /** Only ever read to seed the draft's initial state (this component is
   * remounted on every open — see BlockEditor's own doc comment) — never
   * read again after mount, so a `block` that changes while the modal
   * happens to be open (it can't, today, since nothing else writes to a
   * block while its own modal is open) still wouldn't affect the draft. */
  block: BuilderBlock;
  blockTypeOptions: readonly BlockType[];
  onSave: (draft: BlockDraft) => void;
};

/**
 * The modal's actual fields — a local draft, seeded once from `block` at
 * mount (see BlockEditor's doc comment for why this is its own component,
 * keyed on `openCount`, rather than state living directly in BlockEditor).
 * Every field here reads and writes `draft`, never `block` and never
 * `dispatch` directly; Save is the only thing that ever hands anything
 * back to the parent.
 *
 * Errors clear themselves without a useEffect: each field's own onChange
 * handler already knows exactly which field just changed (it's the one
 * being called), so it updates `errors` for that field in the same
 * handler that updates `draft` — there's nothing to "notice" after the
 * fact the way the /profile forms' `state !== prevState` render-time
 * comparison notices an async Server Action result arriving. Switching
 * blockType clears every timing-field error at once, since that also
 * resets every timing field's value back to null in the same update.
 */
function BlockEditorModalFields({
  block,
  blockTypeOptions,
  onSave,
}: BlockEditorModalFieldsProps) {
  const [draft, setDraft] = useState<BlockDraft>(() => draftFromBlock(block));
  const [errors, setErrors] = useState<BuilderBlockDraftErrors>({});

  function updateTitle(value: string) {
    setDraft((d) => ({ ...d, title: value }));
  }

  function updateBlockType(value: BlockType) {
    setDraft((d) => ({
      ...d,
      blockType: value,
      durationSeconds: null,
      rounds: null,
      workSeconds: null,
      restSeconds: null,
      intervalSeconds: null,
    }));
    setErrors((e) => (Object.keys(e).length === 0 ? e : {}));
  }

  function updateTimingField(
    field:
      | "durationSeconds"
      | "rounds"
      | "workSeconds"
      | "restSeconds"
      | "intervalSeconds",
    value: number | null
  ) {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => {
      if (!(field in e)) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  }

  function handleSaveClick() {
    const validationErrors = validateBuilderBlockDraft(
      {
        blockType: draft.blockType,
        durationSeconds: draft.durationSeconds,
        rounds: draft.rounds,
        workSeconds: draft.workSeconds,
        restSeconds: draft.restSeconds,
        intervalSeconds: draft.intervalSeconds,
      },
      blockTypeOptions
    );
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(draft);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1">
          Title<span className="text-xs text-ink-subtle">(optional)</span>
        </span>
        <input
          type="text"
          maxLength={NAME_MAX_LENGTH}
          value={draft.title}
          onChange={(e) => updateTitle(e.target.value)}
          className="rounded-control border border-hairline bg-surface-1 p-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Block type
        <select
          value={draft.blockType}
          onChange={(e) => updateBlockType(e.target.value as BlockType)}
          className="rounded-control border border-hairline bg-surface-1 p-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          {blockTypeOptions.map((value) => (
            <option key={value} value={value}>
              {BLOCK_TYPE_LABELS[value].label}
            </option>
          ))}
        </select>
        {errors.blockType && (
          <p className="text-sm text-danger">{errors.blockType}</p>
        )}
      </label>

      {(draft.blockType === "for_time" || draft.blockType === "amrap") && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1">
            Duration
            {draft.blockType === "for_time" && (
              <span className="text-xs text-ink-subtle">(optional)</span>
            )}
          </span>
          <DurationInput
            key={draft.blockType}
            maxUnit="hours"
            valueSeconds={draft.durationSeconds}
            onChange={(value) => updateTimingField("durationSeconds", value)}
          />
          {errors.durationSeconds && (
            <p className="text-sm text-danger">{errors.durationSeconds}</p>
          )}
        </label>
      )}

      {(draft.blockType === "for_time" ||
        draft.blockType === "on_off" ||
        draft.blockType === "emom") && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1">
            Rounds
            {draft.blockType === "for_time" && (
              <span className="text-xs text-ink-subtle">(optional)</span>
            )}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            required={draft.blockType === "on_off" || draft.blockType === "emom"}
            value={draft.rounds ?? ""}
            onChange={(e) =>
              updateTimingField(
                "rounds",
                sanitizeNumberInputChange(e, {
                  min: 1,
                  digitLimit: ROUNDS_DIGIT_LIMIT,
                })
              )
            }
            {...numberInputGuardProps()}
            className="h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          />
          {errors.rounds && (
            <p className="text-sm text-danger">{errors.rounds}</p>
          )}
        </label>
      )}

      {draft.blockType === "on_off" && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Work
            <DurationInput
              key={draft.blockType}
              maxUnit="minutes"
              valueSeconds={draft.workSeconds}
              onChange={(value) => updateTimingField("workSeconds", value)}
            />
            {errors.workSeconds && (
              <p className="text-sm text-danger">{errors.workSeconds}</p>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Rest
            <DurationInput
              key={draft.blockType}
              maxUnit="minutes"
              valueSeconds={draft.restSeconds}
              onChange={(value) => updateTimingField("restSeconds", value)}
            />
            {errors.restSeconds && (
              <p className="text-sm text-danger">{errors.restSeconds}</p>
            )}
          </label>
        </>
      )}

      {draft.blockType === "emom" && (
        <label className="flex flex-col gap-1 text-sm">
          Interval
          <DurationInput
            key={draft.blockType}
            maxUnit="minutes"
            valueSeconds={draft.intervalSeconds}
            onChange={(value) => updateTimingField("intervalSeconds", value)}
          />
          {errors.intervalSeconds && (
            <p className="text-sm text-danger">{errors.intervalSeconds}</p>
          )}
        </label>
      )}

      <button
        type="button"
        onClick={handleSaveClick}
        className="flex h-11 items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        Save
      </button>
    </div>
  );
}

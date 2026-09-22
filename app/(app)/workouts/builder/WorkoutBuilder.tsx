"use client";

import { useMemo, useReducer, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, Check } from "lucide-react";
import type { UNIT_SYSTEMS } from "@/db/enums";
import { PendingBanner, PendingSubmitButton } from "@/app/_components/FormStatus";
import { DURATION_MINUTES_DIGIT_LIMIT } from "@/lib/numeric-limits";
import { LONG_TEXT_MAX_LENGTH, NAME_MAX_LENGTH } from "@/lib/text-limits";
import {
  getBuilderRequirements,
  validateBuilderPayload,
  type BuilderRequirementKey,
} from "@/lib/workout-builder-validation";
import { DIFFICULTY_LABELS } from "../difficulty-labels";
import { PRIMARY_TYPE_LABELS } from "../primary-type-labels";
import { createFullWorkout, updateFullWorkout } from "./actions";
import { ADD_BUTTON_TEXT_CLASSES } from "./add-button-classes";
import BlockEditor from "./BlockEditor";
import LeaveButton from "./LeaveButton";
import {
  resolveReorder,
  restrictToParentElement,
  restrictToVerticalAxis,
  sameGroupCollisionDetection,
  type BuilderSortableData,
} from "./dnd";
import {
  builderReducer,
  createBuilderStateFor,
  getCommittedBlocks,
  serializeBuilderState,
  type BlockType,
  type BuilderState,
  type CatalogExercise,
  type CatalogTag,
  type Difficulty,
  type LoadableWorkout,
  type PrimaryType,
  type TargetPreset,
  type TargetType,
  type VolumeType,
} from "./reducer";
import {
  numberInputGuardProps,
  sanitizeNumberInputChange,
} from "../../_components/sanitize-live-number";

const FORM_ID = "builder-form";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

const PANEL_CLASSES =
  "flex min-w-0 flex-col rounded-panel border border-hairline bg-surface-1 p-5 sm:p-6";
const PANEL_HEADING_CLASSES =
  "text-section font-semibold text-ink";
const FIELD_LABEL_CLASSES = "text-xs font-medium text-ink-subtle";
const FIELD_HINT_CLASSES = "font-normal text-ink-tertiary";
const INPUT_CLASSES = `h-11 w-full min-w-0 rounded-control border border-hairline bg-surface-2 px-3 text-base text-ink ${FOCUS_RING}`;

const TAG_CLASSES =
  "rounded-small border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-subtle hover:border-hairline-strong hover:text-ink active:border-hairline-strong active:text-ink " +
  FOCUS_RING;
const TAG_SELECTED_CLASSES =
  "rounded-small border border-hairline-strong bg-surface-3 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink active:text-ink " +
  FOCUS_RING;

// The header back control keeps BackLink's look (an ArrowLeft icon button);
// it is a LeaveButton here so it confirms like Discard when there are changes.
const BACK_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink " +
  FOCUS_RING;

const DISCARD_CLASSES =
  "flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 " +
  FOCUS_RING;
const SAVE_CLASSES =
  "flex h-11 items-center justify-center rounded-control border border-accent bg-accent px-5 text-sm font-medium text-ink enabled:hover:border-accent-hover enabled:hover:bg-accent-hover enabled:active:border-accent-hover enabled:active:bg-accent-hover disabled:cursor-not-allowed disabled:border-hairline disabled:bg-surface-2 disabled:text-ink-tertiary " +
  FOCUS_RING;

const PRIMARY_ADD_CLASSES =
  "flex h-11 items-center justify-center rounded-control bg-accent px-5 text-sm font-medium text-ink hover:bg-accent-hover active:bg-accent-hover " +
  FOCUS_RING;
const ADD_BLOCK_CLASSES =
  `flex h-11 w-full items-center justify-center rounded-control border border-hairline bg-surface-2 ${ADD_BUTTON_TEXT_CLASSES} hover:bg-surface-3 active:bg-surface-3 ` +
  FOCUS_RING;

const REQUIREMENT_LABELS: Record<BuilderRequirementKey, string> = {
  title: "Title",
  primaryType: "Primary type",
  difficulty: "Difficulty",
  blocks: "At least one block",
  items: "Every block has an item",
};

/**
 * Flattens the builder's internal {meta, blocks} state into the flat
 * shape validateBuilderPayload/createFullWorkout expect — the same
 * shape POST /api/workouts/full accepts as JSON. Only committed blocks and
 * items are included — entries the user has added but not yet saved from
 * their modal (pending) are left out, and the `pending` flag itself never
 * reaches the validator or the Server Action. Each block/item's client-only
 * `id` rides along harmlessly; the validator only reads the fields it knows
 * about.
 */
function toBuilderPayload(state: BuilderState) {
  return {
    title: state.meta.title,
    description: state.meta.description,
    primaryType: state.meta.primaryType,
    difficulty: state.meta.difficulty,
    estimatedDurationMinutes: state.meta.estimatedDurationMinutes,
    blocks: getCommittedBlocks(state),
    tagIds: state.meta.tagIds,
  };
}

type WorkoutBuilderProps = {
  /** The page heading ("New workout" / "Edit workout"). The builder renders
   * the whole header row itself, because Save and Discard sit in it. */
  heading: string;
  backHref: string;
  backLabel: string;
  /** Where Discard goes — the same destination as the back link. */
  discardHref: string;
  primaryTypeOptions: readonly PrimaryType[];
  difficultyOptions: readonly Difficulty[];
  blockTypeOptions: readonly BlockType[];
  volumeTypeOptions: readonly VolumeType[];
  targetTypeOptions: readonly TargetType[];
  targetPresetOptions: readonly TargetPreset[];
  exerciseCatalog: readonly CatalogExercise[];
  tagCatalog: readonly CatalogTag[];
  /** Threaded down to every item's DistanceInput (via BlockEditor/
   * ItemEditor) for its unit <select> — the read-only page fetches this
   * once via getUserContext, same as PersonalRecordFields/GoalFields. */
  unitSystem: (typeof UNIT_SYSTEMS)[number];
  /** When present, the builder starts pre-loaded from this workout (via
   * the LOAD_WORKOUT reducer action) and Save edits it in place instead
   * of creating a new one. */
  initialWorkout?: LoadableWorkout;
  /** The workout being edited. Required together with `initialWorkout` —
   * both present means edit mode, both absent means create mode. */
  workoutId?: string;
};

/**
 * Client-side workout builder: the page header (back link, heading, and
 * Discard/Save on sm and up), then Details at full width with Blocks (~68%)
 * and the validation Checklist (~32%) side by side beneath it from lg —
 * stacked as Details, Blocks, Checklist below lg, with Save and Discard at
 * the bottom below sm. The whole tree lives in useReducer state until Save. In create
 * mode (no `initialWorkout`/`workoutId`), Save calls the createFullWorkout
 * Server Action; in edit mode, it calls updateFullWorkout instead, which
 * replaces the existing workout's whole tree. Either way, Save runs
 * validateBuilderPayload locally first, then the action re-validates
 * server-side — the client check is a UX convenience, the server is the
 * gate. Enum option lists are passed in as props from the (Server
 * Component) page rather than imported here, so this file never bundles
 * drizzle-orm into the client. This is the single "use client" boundary for
 * the builder; BlockEditor and ItemEditor are plain function components
 * rendered from here, not their own client boundaries.
 *
 * Save is disabled until validateBuilderPayload passes, and the Checklist
 * rows come from getBuilderRequirements (lib/workout-builder-validation.ts),
 * which is built from the same rule functions — so a row is green exactly
 * when the validator's own check for it passes, and the button and the
 * checklist read one source. When every row is green but validation still
 * fails (block timing, an item's fields…), the validator's message shows
 * under the rows.
 *
 * Blocks reorder by dragging their handle, and items by theirs within their
 * own block (@dnd-kit; see dnd.ts). Reordering is just REORDER_BLOCKS/
 * REORDER_ITEMS on the array — sort_order is still assigned server-side from
 * array position on save.
 *
 * Discard and the header back control are the same LeaveButton: they compare
 * the current state with a snapshot taken when the builder opened (after
 * LOAD_WORKOUT in edit mode, whitespace-trimmed, pending entries ignored) and
 * ask first if they differ.
 *
 * A block or item created by Add is "pending" until its modal Save: it shows
 * on the page (its modal is open) but does not count towards the checklist,
 * Save, the dirty comparison or the payload (getCommittedBlocks). Cancelling
 * the modal removes it, as before.
 *
 * The fields are wrapped in a <form id="builder-form" onSubmit={...}> purely
 * for semantics and so pressing Enter in a text field submits — not a React
 * 19 Action: every field here is controlled via the reducer and none of them
 * carry a `name`, so FormData has nothing to read, and `action={handleSave}`
 * was tried and reverted — React calls the native form.reset() as the last
 * DOM operation of every Action's commit (success or failure), which
 * silently wiped controlled inputs on a failed save even though the reducer
 * state was untouched. onSubmit only calls preventDefault + handleSave, so no
 * such reset ever runs. Pending state is therefore a plain `isSaving` state
 * variable instead of useFormStatus — see PendingBanner/PendingSubmitButton
 * (app/_components/FormStatus.tsx), the prop-driven counterparts to
 * FormPendingBanner/SubmitButton kept for this reason. Save and Discard sit
 * outside the form (they belong to the header, and Discard's ConfirmModal
 * carries its own <form>, which cannot nest); Save reaches the form through
 * its `form` attribute. No FormSuccessBanner: both createFullWorkout and
 * updateFullWorkout redirect() on success, so this component unmounts before
 * any success state could render. The workout detail page shows the success
 * confirmation instead, via RedirectSuccessBanner reading the `?saved=1`
 * both actions append to their redirect target (see app/_components/
 * FormStatus.tsx and workouts/[id]/page.tsx).
 *
 * `noValidate` on the <form> is required, not cosmetic: BlockEditor's Rounds
 * input is natively `required` for on_off/emom, and Modal never unmounts a
 * closed block's fields (see Modal.tsx) — it only hides them via the native
 * dialog:not([open]) { display: none } rule. A `required`-and-empty field
 * that becomes unrenderable this way is still a submission candidate per
 * the HTML spec (display:none isn't one of the listed bar-from-validation
 * reasons), but isn't focusable either, so the browser silently aborts the
 * submit event instead of showing its usual validation bubble — handleSave
 * never runs, and whatever saveError was already on screen just sits there
 * unchanged, looking exactly like a stale error message. `noValidate`
 * removes native constraint validation from the picture entirely, leaving
 * validateBuilderPayload as the only thing that ever decides whether Save
 * succeeds — which was already the intent (see above).
 */
export default function WorkoutBuilder({
  heading,
  backHref,
  backLabel,
  discardHref,
  primaryTypeOptions,
  difficultyOptions,
  blockTypeOptions,
  volumeTypeOptions,
  targetTypeOptions,
  targetPresetOptions,
  exerciseCatalog,
  tagCatalog,
  unitSystem,
  initialWorkout,
  workoutId,
}: WorkoutBuilderProps) {
  // Computed once: the state the builder opened in. In edit mode this already
  // includes LOAD_WORKOUT, so the Discard snapshot below is taken after it.
  const [initialState] = useState(() => createBuilderStateFor(initialWorkout));
  const [state, dispatch] = useReducer(builderReducer, initialState);
  const [snapshot] = useState(() => serializeBuilderState(initialState));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** The most recently ADD_BLOCK-ed block's id, so that block's
   * BlockEditor can auto-open its modal once. Generated here (not by the
   * reducer) so it's known in the same tick as the dispatch — see
   * AddBlockAction's doc comment in reducer.ts. */
  const [lastAddedBlockId, setLastAddedBlockId] = useState<string | null>(null);

  /** Derived from exerciseCatalog rather than threaded down as its own
   * prop — every caller of validateBuilderPayload/validateBuilderItemDraft
   * computes restExerciseIds from a catalog it already has (see
   * BuilderEnumOptions' own doc comment). */
  const enumOptions = useMemo(
    () => ({
      primaryTypeOptions,
      difficultyOptions,
      blockTypeOptions,
      volumeTypeOptions,
      targetTypeOptions,
      targetPresetOptions,
      restExerciseIds: exerciseCatalog
        .filter((exercise) => exercise.category === "rest")
        .map((exercise) => exercise.id),
    }),
    [
      primaryTypeOptions,
      difficultyOptions,
      blockTypeOptions,
      volumeTypeOptions,
      targetTypeOptions,
      targetPresetOptions,
      exerciseCatalog,
    ]
  );

  const { requirements, valid, remainingError } = useMemo(
    () => getBuilderRequirements(toBuilderPayload(state), enumOptions),
    [state, enumOptions]
  );
  const dirty = useMemo(
    () => serializeBuilderState(state) !== snapshot,
    [state, snapshot]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // A distance constraint, like the mouse's — not a delay. The handle is
    // touch-action: none, so a touch that starts on it cannot scroll the page
    // and needs no press-and-hold to tell the two apart; a delay + tolerance
    // constraint cancels the drag if the finger moves more than the tolerance
    // before the delay elapses, which is what a normal grab-and-drag does.
    useSensor(TouchSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const reorder = resolveReorder(
      active.data.current as BuilderSortableData | undefined,
      over.data.current as BuilderSortableData | undefined
    );
    if (reorder?.kind === "block") {
      dispatch({
        type: "REORDER_BLOCKS",
        activeId: String(active.id),
        overId: String(over.id),
      });
    } else if (reorder?.kind === "item") {
      dispatch({
        type: "REORDER_ITEMS",
        blockId: reorder.blockId,
        activeId: String(active.id),
        overId: String(over.id),
      });
    }
  }

  function addBlock() {
    const id = crypto.randomUUID();
    setLastAddedBlockId(id);
    dispatch({ type: "ADD_BLOCK", id });
  }

  /** Clears saveError up front, before validation runs, rather than only
   * ever overwriting it in the failure branch below — belt-and-braces
   * alongside the <form>'s `noValidate` above, so a message from a
   * previous attempt can never survive a run that produces no message of
   * its own. */
  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    const payload = toBuilderPayload(state);
    const result = validateBuilderPayload(payload, enumOptions);

    if (!result.success) {
      setSaveError(result.error);
      setIsSaving(false);
      return;
    }

    const response = workoutId
      ? await updateFullWorkout(workoutId, payload)
      : await createFullWorkout(payload);
    if (response?.error) {
      setSaveError(response.error);
      setIsSaving(false);
    }
  }

  // The empty state and its layout follow every block, pending or not (a
  // pending block's card hosts the open modal); the "N blocks" count only
  // counts committed ones.
  const blockCount = state.blocks.length;
  const committedBlockCount = state.blocks.filter((b) => !b.pending).length;
  // The Checklist always keeps its natural height. While empty, the Blocks
  // panel stretches to the row (whose height is the Checklist's, because the
  // empty state is kept shorter than it), so the two line up; with blocks it
  // is natural height like everything else.
  const blocksAlignClasses = blockCount === 0 ? "lg:self-stretch" : "lg:self-start";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <LeaveButton
            href={backHref}
            dirty={dirty}
            className={BACK_CLASSES}
            ariaLabel={`Back to ${backLabel}`}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </LeaveButton>
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-ink sm:text-page-title-compact">
            {heading}
          </h1>
        </div>

        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          <LeaveButton href={discardHref} dirty={dirty} className={DISCARD_CLASSES}>
            Discard
          </LeaveButton>
          <PendingSubmitButton
            pending={isSaving}
            disabled={!valid}
            form={FORM_ID}
            className={SAVE_CLASSES}
          >
            Save workout
          </PendingSubmitButton>
        </div>
      </div>

      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,68fr)_minmax(0,32fr)] lg:items-start"
      >
        <section className={`${PANEL_CLASSES} gap-4 lg:col-span-2`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={PANEL_HEADING_CLASSES}>Details</h2>
            <span className="text-right text-xs text-ink-tertiary">
              Title, type and difficulty are required
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASSES}>Title</span>
              <input
                type="text"
                required
                maxLength={NAME_MAX_LENGTH}
                value={state.meta.title}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_META_FIELD",
                    field: "title",
                    value: e.target.value,
                  })
                }
                className={INPUT_CLASSES}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASSES}>
                Description <span className={FIELD_HINT_CLASSES}>optional</span>
              </span>
              <textarea
                maxLength={LONG_TEXT_MAX_LENGTH}
                value={state.meta.description}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_META_FIELD",
                    field: "description",
                    value: e.target.value,
                  })
                }
                className={`min-h-[76px] w-full min-w-0 rounded-control border border-hairline bg-surface-2 px-3 py-2.5 text-base text-ink ${FOCUS_RING}`}
              />
            </label>

          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASSES}>Primary type</span>
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
                className={INPUT_CLASSES}
              >
                <option value="" disabled>
                  Select a type
                </option>
                {primaryTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {PRIMARY_TYPE_LABELS[value].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASSES}>Difficulty</span>
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
                className={INPUT_CLASSES}
              >
                <option value="" disabled>
                  Select a difficulty
                </option>
                {difficultyOptions.map((value) => (
                  <option key={value} value={value}>
                    {DIFFICULTY_LABELS[value].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASSES}>
                Duration (min) <span className={FIELD_HINT_CLASSES}>optional</span>
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={state.meta.estimatedDurationMinutes ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_META_FIELD",
                    field: "estimatedDurationMinutes",
                    // Same DURATION_MINUTES_DIGIT_LIMIT
                    // validateBuilderPayload checks this field against.
                    value: sanitizeNumberInputChange(e, {
                      min: 1,
                      digitLimit: DURATION_MINUTES_DIGIT_LIMIT,
                    }),
                  })
                }
                {...numberInputGuardProps()}
                className={INPUT_CLASSES}
              />
            </label>

          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <span className={FIELD_LABEL_CLASSES}>
              Tags{" "}
              <span className={FIELD_HINT_CLASSES}>
                optional
                {state.meta.tagIds.length > 0 &&
                  ` · ${state.meta.tagIds.length} selected`}
              </span>
            </span>
            <div className="flex flex-wrap gap-2">
              {tagCatalog.length === 0 ? (
                <p className="text-sm text-ink-subtle">No tags available.</p>
              ) : (
                tagCatalog.map((tag) => {
                  const selected = state.meta.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        dispatch({ type: "TOGGLE_TAG", tagId: tag.id })
                      }
                      className={selected ? TAG_SELECTED_CLASSES : TAG_CLASSES}
                    >
                      {tag.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className={`${PANEL_CLASSES} gap-4 lg:col-start-1 lg:row-start-2 ${blocksAlignClasses}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={PANEL_HEADING_CLASSES}>Blocks</h2>
            <span className="text-right text-xs text-ink-tertiary">
              {committedBlockCount === 0
                ? "No blocks yet"
                : `${committedBlockCount} block${committedBlockCount === 1 ? "" : "s"} · drag the handle to reorder`}
            </span>
          </div>

          {blockCount === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-card border border-hairline bg-surface-2 px-5 py-4 sm:px-6 sm:py-5">
              <p className="text-sm font-medium text-ink-muted">
                A workout needs at least one block
              </p>
              <p className="max-w-[420px] text-[13px] leading-[1.55] text-ink-tertiary">
                A block groups items that run together — a warm-up, a main
                set, an EMOM. Each item carries sets, volume, an intensity
                target, weight and rest.
              </p>
              <button type="button" onClick={addBlock} className={PRIMARY_ADD_CLASSES}>
                Add first block
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <DndContext
                id="workout-builder-dnd"
                sensors={sensors}
                collisionDetection={sameGroupCollisionDetection}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                autoScroll={{ threshold: { x: 0, y: 0.2 } }}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={state.blocks.map((block) => block.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-3">
                    {state.blocks.map((block, index) => (
                      <BlockEditor
                        key={block.id}
                        block={block}
                        index={index}
                        autoOpen={block.id === lastAddedBlockId}
                        blockTypeOptions={blockTypeOptions}
                        catalog={exerciseCatalog}
                        volumeTypeOptions={volumeTypeOptions}
                        targetTypeOptions={targetTypeOptions}
                        targetPresetOptions={targetPresetOptions}
                        unitSystem={unitSystem}
                        dispatch={dispatch}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button type="button" onClick={addBlock} className={ADD_BLOCK_CLASSES}>
                Add block
              </button>
            </div>
          )}
        </section>

        <section className={`${PANEL_CLASSES} gap-3 lg:col-start-2 lg:row-start-2 lg:self-start`}>
          <h2 className={PANEL_HEADING_CLASSES}>Checklist</h2>

          <ul className="flex flex-col">
            {requirements.map(({ key, met }) => (
              <li
                key={key}
                className="flex items-center gap-2.5 border-b border-surface-3 py-2.5 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-small border ${
                    met
                      ? "border-success bg-success text-canvas"
                      : "border-hairline bg-surface-3"
                  }`}
                >
                  {met && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span
                  className={`text-[13px] ${met ? "text-ink-muted" : "text-ink-tertiary"}`}
                >
                  {REQUIREMENT_LABELS[key]}
                  <span className="sr-only">{met ? " — done" : " — not done"}</span>
                </span>
              </li>
            ))}
          </ul>

          {remainingError && (
            <p className="text-xs leading-[1.5] text-ink-subtle">
              {remainingError}
            </p>
          )}

          {saveError && (
            <p
              role="alert"
              className="break-words rounded-control border border-danger/40 bg-surface-2 p-2 text-sm text-danger"
            >
              {saveError}
            </p>
          )}
        </section>
      </form>

      <div className="flex flex-col gap-3 sm:hidden">
        <PendingSubmitButton
          pending={isSaving}
          disabled={!valid}
          form={FORM_ID}
          className={`${SAVE_CLASSES} h-12 w-full`}
        >
          Save workout
        </PendingSubmitButton>
        <LeaveButton
          href={discardHref}
          dirty={dirty}
          className={`${DISCARD_CLASSES} w-full`}
        >
          Discard
        </LeaveButton>
      </div>

      <PendingBanner pending={isSaving} label="Saving…" />
    </div>
  );
}

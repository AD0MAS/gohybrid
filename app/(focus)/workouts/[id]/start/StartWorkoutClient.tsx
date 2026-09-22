"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/app/(app)/_components/ConfirmModal";
import { BLOCK_TYPE_LABELS } from "@/app/(app)/workouts/builder/block-type-labels";
import { TARGET_PRESET_LABELS } from "@/app/(app)/workouts/builder/target-preset-labels";
import { TARGET_TYPE_LABELS } from "@/app/(app)/workouts/builder/target-type-labels";
import { FormErrorMessage, PendingBanner } from "@/app/_components/FormStatus";
import type { UNIT_SYSTEMS } from "@/db/enums";
import {
  IDLE_CLOCK,
  clockStatus,
  computeStartProgress,
  elapsedMs,
  finishDurationSeconds,
  parseStoredState,
  pauseClock,
  resumeClock,
  shouldConfirmLeave,
  startClock,
  type BlockState,
  type StartClock,
  type StoredStartState,
} from "@/lib/start-progress";
import { formatDurationSeconds } from "@/lib/units";
import { formatBlockSummary, formatItemSummary } from "@/lib/workout-summary";
import type { getWorkoutForUser } from "@/lib/workouts";
import { finishWorkout } from "./actions";
import StartLeaveButton from "./StartLeaveButton";

type Workout = NonNullable<Awaited<ReturnType<typeof getWorkoutForUser>>>;
type UnitSystem = (typeof UNIT_SYSTEMS)[number];

type StartWorkoutClientProps = {
  workout: Workout;
  unitSystem: UnitSystem;
  typeLabel: string;
  difficultyLabel: string;
};

const ITEM_SUMMARY_LABELS = {
  targetPreset: TARGET_PRESET_LABELS,
  targetType: TARGET_TYPE_LABELS,
};
const BLOCK_SUMMARY_LABELS = { blockType: BLOCK_TYPE_LABELS };

const BLOCK_STATE_LABELS: Record<BlockState, { label: string; ink: string }> = {
  done: { label: "Done", ink: "text-success" },
  in_progress: { label: "In progress", ink: "text-accent-ink-subtle" },
  not_started: { label: "Not started", ink: "text-ink-subtle" },
};

const BUTTON_BASE =
  "flex h-11 items-center justify-center rounded-control px-5 text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus disabled:opacity-50";
const PRIMARY_BUTTON = `${BUTTON_BASE} bg-accent text-white hover:bg-accent-hover active:bg-accent-hover`;
const SECONDARY_BUTTON = `${BUTTON_BASE} border border-hairline bg-surface-1 text-ink hover:bg-surface-2 active:bg-surface-2`;

const PANEL = "rounded-panel border border-hairline bg-surface-1";

function storageKey(workoutId: string) {
  return `gohybrid:start-workout:${workoutId}`;
}

function itemsLeftLabel(count: number) {
  if (count === 0) return "All items done";
  return `${count} item${count === 1 ? "" : "s"} left`;
}

/**
 * Start Workout Mode's whole screen: header (leave, title, elapsed clock),
 * the checklist with its progress, and the footer actions. The clock runs
 * from the moment the page opens (Pause and Resume stop and restart it).
 * Checkbox and clock state are UI-only until Finish, which writes one session
 * carrying the active duration, but both survive a reload through
 * localStorage, since a real workout runs 40-60 minutes and phones lock their
 * screens in between.
 *
 * The stored state (lib/start-progress.ts, StoredStartState) is keyed by
 * workout id and stamped with the workout's `updated_at`, so an edited
 * workout discards it, and with a last-written time, so anything older than
 * 12 hours is ignored and cleared. Elapsed time is always computed from
 * Date.now(), never counted per tick: the 1 s interval only repaints, so a
 * throttled background tab stays correct. There is one checkbox per item —
 * block `rounds` and item `sets` are information only.
 *
 * Finish is always the one accent fill; Pause/Resume and Discard are
 * bordered secondaries.
 *
 * Finish can be confirmed ("N items left. Finish anyway?") through a modal.
 * Its confirm is a plain button (ConfirmModal's `onConfirm`), not a form
 * action: a form action runs inside a transition, and a state update made
 * there shares one transition lane with the router's server-action dispatch,
 * which suspends until the server answers — so "Finishing…" would never paint.
 * Both paths call the same finish() from a click handler, where setIsFinishing
 * is a discrete-event update that commits at once.
 */
export default function StartWorkoutClient({
  workout,
  unitSystem,
  typeLabel,
  difficultyLabel,
}: StartWorkoutClientProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState<StartClock>(IDLE_CLOCK);
  const [now, setNow] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const router = useRouter();
  const workoutUpdatedAt = workout.updatedAt.toISOString();
  // Set once the stored state has been cleared on purpose (leave or finish),
  // so the persist effect can't write it back before the page unmounts.
  const clearedRef = useRef(false);
  // Guards a second finish() in the same tick, before isFinishing re-renders.
  const finishingRef = useRef(false);

  // localStorage doesn't exist during server rendering, so the saved state is
  // read here, after mount, rather than during render.
  useEffect(() => {
    const key = storageKey(workout.id);
    const openedAt = Date.now();
    let restored: StoredStartState | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      restored = parseStoredState(raw, workoutUpdatedAt, openedAt);
      if (raw && !restored) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Inaccessible storage — start from an empty checklist.
    }
    // A lazy useState initializer would run during the server render too and
    // desync from the client's hydration output, so this read can only
    // happen post-mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (restored) {
      setChecked(new Set(restored.checkedItemIds));
    }
    // The clock starts on open. A restored clock resumes as it was; state
    // saved without a running clock (startedAt null) starts one now.
    setClock(
      restored && restored.startedAt !== null
        ? {
            startedAt: restored.startedAt,
            activeMs: restored.activeMs,
            runningSince: restored.runningSince,
          }
        : startClock(openedAt)
    );
    setNow(openedAt);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [workout.id, workoutUpdatedAt]);

  // Skipped until the read above has run once, so this doesn't fire first and
  // overwrite saved state with an empty one.
  useEffect(() => {
    if (!hydrated || clearedRef.current) {
      return;
    }
    const key = storageKey(workout.id);
    try {
      const payload: StoredStartState = {
        version: 2,
        workoutUpdatedAt,
        checkedItemIds: Array.from(checked),
        startedAt: clock.startedAt,
        activeMs: clock.activeMs,
        runningSince: clock.runningSince,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Storage full or inaccessible — state just won't survive a reload.
    }
  }, [hydrated, checked, clock, workout.id, workoutUpdatedAt]);

  const status = clockStatus(clock);

  // While running, repaint every second and again the moment the tab becomes
  // visible; the value itself always comes from Date.now().
  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [status]);

  const progress = computeStartProgress(workout.blocks, checked);
  const itemsLeft = progress.totalItems - progress.checkedItems;
  const needsLeaveConfirm = shouldConfirmLeave(checked.size, clock, now);
  const elapsedSeconds = Math.floor(elapsedMs(clock, now) / 1000);

  function toggleItem(itemId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handlePauseResume() {
    const t = Date.now();
    setNow(t);
    setClock((prev) =>
      prev.runningSince === null ? resumeClock(prev, t) : pauseClock(prev, t)
    );
  }

  function clearStored() {
    clearedRef.current = true;
    try {
      window.localStorage.removeItem(storageKey(workout.id));
    } catch {
      // Inaccessible storage — nothing to clean up.
    }
  }

  /**
   * Creates the workout_session with the active duration (pauses excluded),
   * then clears the stored state and redirects to History. The clear has to happen client-side after the action
   * resolves — rather than inside finishWorkout itself — since localStorage
   * doesn't exist on the server.
   *
   * The `?finished=1` param (read by /history's FinishedNotice) is
   * appended here rather than reused from `?saved=1` — a distinct value
   * because the label at the destination is "Finished", not "Saved", and
   * this component unmounts on navigation so nothing here can rely on
   * FormSuccessBanner's own-component retrigger.
   */
  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);
    setFinishError(null);
    try {
      await finishWorkout(
        workout.id,
        finishDurationSeconds(clock, Date.now())
      );
      clearStored();
      // isFinishing stays true: the page is about to unmount.
      router.push("/history?finished=1");
    } catch {
      finishingRef.current = false;
      setIsFinishing(false);
      setFinishError("Couldn't finish this workout. It may have been deleted.");
    }
  }

  // Mobile: Finish full-width, then Pause/Resume and Discard in one row. From
  // sm: one row — Discard, Pause/Resume, Finish.
  const finishClasses = `${PRIMARY_BUTTON} order-1 col-span-2 sm:order-3 sm:col-auto`;

  // The confirm closes the modal and calls finish() from its click handler,
  // exactly like the direct button, so the banner isn't hidden under an open
  // dialog (top layer) or held back by a transition.
  const finishControl =
    itemsLeft > 0 ? (
      <ConfirmModal
        trigger="Finish workout"
        triggerClassName={finishClasses}
        triggerDisabled={isFinishing}
        title="Finish workout?"
        description={`${itemsLeft} item${itemsLeft === 1 ? "" : "s"} left. Finish anyway?`}
        cancelLabel="Keep going"
        confirmLabel="Finish"
        variant="primary"
        onConfirm={() => void finish()}
      />
    ) : (
      <button
        type="button"
        onClick={() => void finish()}
        disabled={isFinishing}
        className={finishClasses}
      >
        Finish workout
      </button>
    );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-canvas px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-12 sm:pb-[18px] sm:pt-[max(1.125rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
          <StartLeaveButton
            href={`/workouts/${workout.id}`}
            needsConfirm={needsLeaveConfirm}
            onLeave={clearStored}
            ariaLabel="Leave workout"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-small border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </StartLeaveButton>
          <div className="min-w-0">
            <h1 className="break-words text-sm font-medium leading-tight text-ink">
              {workout.title}
            </h1>
            <p className="mt-1 text-[11px] text-ink-tertiary sm:text-xs">
              {typeLabel}
              <span className="hidden sm:inline"> · {difficultyLabel}</span>
              {workout.estimatedDurationMinutes != null &&
                ` · ${workout.estimatedDurationMinutes} min`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-[3px] sm:flex-row-reverse sm:items-center sm:gap-3">
          <span
            role="timer"
            className={`text-lg font-semibold leading-none tabular-nums sm:text-xl ${
              status === "running" ? "text-ink" : "text-ink-tertiary"
            }`}
          >
            {formatDurationSeconds(elapsedSeconds)}
          </span>
          <span className="text-[10px] leading-none text-ink-tertiary sm:text-xs sm:text-ink-subtle">
            {status === "paused" ? "Paused" : "Elapsed"}
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-5 pb-6 pt-4 sm:px-12 sm:pb-10 sm:pt-8">
        <div className="flex w-full max-w-[820px] flex-col gap-4 sm:gap-6">
          <section className={`${PANEL} p-4 sm:px-6 sm:py-5`}>
            <div className="mb-3 flex items-baseline justify-between gap-3 sm:mb-3.5">
              <h2 className="text-section font-semibold text-ink">
                Progress
              </h2>
              <span className="text-xs text-ink-tertiary">
                {progress.checkedItems} of {progress.totalItems} items
                <span className="hidden sm:inline">
                  {" "}
                  · {progress.doneBlocks} of {progress.totalBlocks} blocks
                </span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Workout progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
              className="mb-2.5 h-2 overflow-hidden rounded-bar bg-surface-3"
            >
              <div
                className="h-full rounded-bar bg-accent"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between gap-3 text-xs text-ink-tertiary">
              <span className="min-w-0 break-words">
                {progress.active
                  ? `${
                      workout.blocks[progress.active.blockIndex].title ||
                      `Block ${progress.active.blockIndex + 1}`
                    } · item ${progress.active.itemNumber} of ${progress.active.itemsInBlock}`
                  : "All items done"}
              </span>
              <span>{progress.percent}%</span>
            </div>
          </section>

          {workout.blocks.length === 0 ? (
            <p className="text-sm text-ink-subtle">
              This workout has no blocks yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-4 sm:gap-6">
              {workout.blocks.map((block, blockIndex) => {
                const state = progress.blockStates.get(block.id) ?? "not_started";
                const stateLabel = BLOCK_STATE_LABELS[state];

                return (
                  <li key={block.id} className={`${PANEL} p-4 sm:px-6 sm:pb-[22px] sm:pt-5`}>
                    <div className="mb-3 flex flex-col gap-1.5 sm:mb-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <h3 className="min-w-0 break-words text-section font-semibold text-ink">
                          {block.title || `Block ${blockIndex + 1}`}
                        </h3>
                        <span
                          className={`shrink-0 rounded-small border border-hairline bg-surface-3 px-2 py-[3px] text-[11px] font-medium ${stateLabel.ink}`}
                        >
                          {stateLabel.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-tertiary sm:text-xs">
                        {formatBlockSummary(
                          block,
                          block.items.length,
                          BLOCK_SUMMARY_LABELS
                        )}
                      </span>
                    </div>

                    {block.items.length === 0 ? (
                      <p className="text-sm text-ink-subtle">No items yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-2.5">
                        {block.items.map((item) => {
                          const name =
                            item.exercise?.name ??
                            item.customName ??
                            "Unnamed exercise";
                          const summaryLine = formatItemSummary(
                            {
                              isRestItem: item.exercise?.category === "rest",
                              isHyroxStation:
                                item.exercise?.isHyroxStation ?? false,
                              sets: item.sets,
                              volumeType: item.volumeType,
                              volumeValue: item.volumeValue,
                              targetType: item.targetType,
                              targetValue: item.targetValue,
                              targetPreset: item.targetPreset,
                              weightKg: item.weightKg,
                              restSeconds: item.restSeconds,
                            },
                            unitSystem,
                            ITEM_SUMMARY_LABELS
                          );
                          const isChecked = checked.has(item.id);
                          const isActive = progress.activeItemId === item.id;

                          return (
                            <li key={item.id}>
                              <label
                                className={`flex cursor-pointer items-center gap-3 rounded-card border bg-surface-2 p-3.5 hover:bg-surface-3 active:bg-surface-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-focus sm:gap-3.5 sm:p-4 ${
                                  isActive ? "border-accent" : "border-hairline"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isChecked}
                                  onChange={() => toggleItem(item.id)}
                                />
                                <span
                                  aria-hidden="true"
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-small border ${
                                    isChecked
                                      ? "border-success bg-success text-canvas"
                                      : isActive
                                        ? "border-hairline-strong bg-surface-3"
                                        : "border-hairline bg-surface-3"
                                  }`}
                                >
                                  {isChecked && (
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                  )}
                                </span>
                                <span className="flex min-w-0 flex-col gap-1.5">
                                  <span
                                    className={`break-words text-[15px] font-medium leading-snug ${
                                      isChecked
                                        ? "text-ink-subtle line-through"
                                        : "text-ink"
                                    }`}
                                  >
                                    {name}
                                  </span>
                                  {summaryLine && (
                                    <span className="text-[11px] leading-snug text-ink-tertiary sm:text-xs">
                                      {summaryLine}
                                    </span>
                                  )}
                                  {item.notes && (
                                    <span className="break-words text-[11px] leading-snug text-ink-tertiary sm:text-xs">
                                      {item.notes}
                                    </span>
                                  )}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-hairline bg-canvas px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-12 sm:py-4">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <p className="text-center text-xs text-ink-tertiary sm:text-left sm:text-[13px]">
            {itemsLeftLabel(itemsLeft)}
          </p>

          <div className="flex flex-col gap-2 sm:items-center sm:gap-3">
            <FormErrorMessage error={finishError} />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={handlePauseResume}
                disabled={!hydrated || isFinishing}
                className={`${SECONDARY_BUTTON} order-2`}
              >
                {status === "paused" ? "Resume" : "Pause"}
              </button>
              {finishControl}
              <StartLeaveButton
                href={`/workouts/${workout.id}`}
                needsConfirm={needsLeaveConfirm}
                onLeave={clearStored}
                className={`${SECONDARY_BUTTON} order-3 sm:order-1`}
              >
                Discard
              </StartLeaveButton>
            </div>
          </div>
        </div>

        {/* Anchored to the bar, not the viewport, so it sits clear of it at
            any height (the bar grows with the safe area and the error line). */}
        <PendingBanner
          pending={isFinishing}
          label="Finishing…"
          placement="absolute inset-x-0 bottom-full mb-3"
        />
      </footer>
    </div>
  );
}

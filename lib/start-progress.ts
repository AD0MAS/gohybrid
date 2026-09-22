import {
  SESSION_DURATION_MAX_SECONDS,
  SESSION_DURATION_MIN_SECONDS,
} from "./sessions-validation";

// Pure helpers for Start Workout Mode's clock, stored progress and progress
// figures. No db import, so the Start client component can use them.

/** Stored progress older than this (since its last write) is ignored. */
const START_STATE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * The session clock, which starts running when the Start page opens.
 * `startedAt` is null only before that first load (the server render) and
 * tells "not started yet" from "paused at 0:00". `activeMs` is the active time
 * banked before the current run, `runningSince` the instant the current run
 * began (null while paused or not started) — so pauses are never counted and
 * elapsed time is always derived from `Date.now()`, never from a tick counter
 * a throttled background tab could under-count.
 */
export type StartClock = {
  startedAt: number | null;
  activeMs: number;
  runningSince: number | null;
};

type ClockStatus = "idle" | "running" | "paused";

export const IDLE_CLOCK: StartClock = {
  startedAt: null,
  activeMs: 0,
  runningSince: null,
};

export function clockStatus(clock: StartClock): ClockStatus {
  if (clock.startedAt === null) return "idle";
  return clock.runningSince === null ? "paused" : "running";
}

/** Active milliseconds at `now`. Floored at 0 against clock adjustments. */
export function elapsedMs(clock: StartClock, now: number): number {
  const running =
    clock.runningSince !== null ? now - clock.runningSince : 0;
  return Math.max(0, clock.activeMs + running);
}

export function startClock(now: number): StartClock {
  return { startedAt: now, activeMs: 0, runningSince: now };
}

export function pauseClock(clock: StartClock, now: number): StartClock {
  if (clock.runningSince === null) return clock;
  return { ...clock, activeMs: elapsedMs(clock, now), runningSince: null };
}

export function resumeClock(clock: StartClock, now: number): StartClock {
  if (clock.startedAt === null || clock.runningSince !== null) return clock;
  return { ...clock, runningSince: now };
}

/**
 * The duration Finish sends: the active time in whole seconds, held to the
 * validator's bounds (at least 1 s, at most 24 h) so Finish can never be
 * rejected for it.
 */
export function finishDurationSeconds(clock: StartClock, now: number): number {
  const seconds = Math.round(elapsedMs(clock, now) / 1000);
  return Math.min(
    SESSION_DURATION_MAX_SECONDS,
    Math.max(SESSION_DURATION_MIN_SECONDS, seconds)
  );
}

/** What is persisted to localStorage for one workout. */
export type StoredStartState = StartClock & {
  version: 2;
  /** The workout's `updated_at`: an edited workout discards saved progress. */
  workoutUpdatedAt: string;
  checkedItemIds: string[];
  /** Epoch ms of the last write, for the staleness check. */
  savedAt: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Parses a stored value and decides whether it may be restored. Returns null
 * — meaning "ignore it and clear the key" — for missing or corrupt data, an
 * old-shape blob (no version), progress saved against a different version of
 * the workout, or state last written more than 12 hours ago.
 */
export function parseStoredState(
  raw: string | null,
  workoutUpdatedAt: string,
  now: number
): StoredStartState | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;

  const stored = value as Record<string, unknown>;
  if (
    stored.version !== 2 ||
    stored.workoutUpdatedAt !== workoutUpdatedAt ||
    !Array.isArray(stored.checkedItemIds) ||
    !stored.checkedItemIds.every((id) => typeof id === "string") ||
    !isFiniteNumber(stored.savedAt) ||
    !isFiniteNumber(stored.activeMs) ||
    (stored.startedAt !== null && !isFiniteNumber(stored.startedAt)) ||
    (stored.runningSince !== null && !isFiniteNumber(stored.runningSince))
  ) {
    return null;
  }

  if (now - stored.savedAt > START_STATE_MAX_AGE_MS) return null;

  return {
    version: 2,
    workoutUpdatedAt,
    checkedItemIds: stored.checkedItemIds as string[],
    startedAt: stored.startedAt as number | null,
    activeMs: stored.activeMs,
    runningSince: stored.runningSince as number | null,
    savedAt: stored.savedAt,
  };
}

/** Active time beyond which leaving asks for confirmation even with nothing ticked. */
const LEAVE_CONFIRM_ELAPSED_MS = 60 * 1000;

/**
 * Whether leaving (✕ or Discard) must ask first: something is ticked, or more
 * than a minute of active time has run. Otherwise the visit is too small to
 * lose anything and leaving is immediate.
 */
export function shouldConfirmLeave(
  checkedCount: number,
  clock: StartClock,
  now: number
): boolean {
  return checkedCount > 0 || elapsedMs(clock, now) > LEAVE_CONFIRM_ELAPSED_MS;
}

export type BlockState = "done" | "in_progress" | "not_started";

type ProgressBlock = { id: string; items: { id: string }[] };

type StartProgress = {
  totalItems: number;
  checkedItems: number;
  /** Blocks that have at least one item — an empty block can't be finished. */
  totalBlocks: number;
  doneBlocks: number;
  percent: number;
  blockStates: Map<string, BlockState>;
  /** The first unchecked item in workout order, or null once all are ticked. */
  activeItemId: string | null;
  /** Position of the active item: its block, and "item N of M" within it. */
  active: { blockIndex: number; itemNumber: number; itemsInBlock: number } | null;
};

/** Derives every progress figure from the checked item ids alone. */
export function computeStartProgress(
  blocks: ProgressBlock[],
  checked: ReadonlySet<string>
): StartProgress {
  let totalItems = 0;
  let checkedItems = 0;
  let totalBlocks = 0;
  let doneBlocks = 0;
  let activeItemId: string | null = null;
  let active: StartProgress["active"] = null;
  const blockStates = new Map<string, BlockState>();

  blocks.forEach((block, blockIndex) => {
    const checkedInBlock = block.items.filter((item) => checked.has(item.id))
      .length;
    totalItems += block.items.length;
    checkedItems += checkedInBlock;

    let state: BlockState = "not_started";
    if (block.items.length > 0) {
      totalBlocks += 1;
      if (checkedInBlock === block.items.length) {
        state = "done";
        doneBlocks += 1;
      } else if (checkedInBlock > 0) {
        state = "in_progress";
      }
    }
    blockStates.set(block.id, state);

    if (activeItemId === null) {
      const index = block.items.findIndex((item) => !checked.has(item.id));
      if (index !== -1) {
        activeItemId = block.items[index].id;
        active = {
          blockIndex,
          itemNumber: index + 1,
          itemsInBlock: block.items.length,
        };
      }
    }
  });

  return {
    totalItems,
    checkedItems,
    totalBlocks,
    doneBlocks,
    percent:
      totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100),
    blockStates,
    activeItemId,
    active,
  };
}

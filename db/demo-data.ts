// The demo account's content, kept apart from db/seed-demo.ts so it stays
// pure data: nothing here imports `db`, so it can be read (or checked
// against the validators) without a database connection. Every date is
// relative to the day the seed runs, so a fresh seed always looks current.

import type {
  BLOCK_TYPES,
  BODY_METRIC_TYPES,
  EVENT_TYPES,
  PERSONAL_RECORD_TYPES,
  TARGET_PRESETS,
  TARGET_TYPES,
  VOLUME_TYPES,
  WORKOUT_DIFFICULTIES,
  WORKOUT_PRIMARY_TYPES,
} from "./enums";
import { addDays, diffInDays, getIsoWeekday, getMondayOfWeek } from "@/lib/dates";
import type { RawBuilderPayload } from "@/lib/workout-builder-validation";

export const DEMO_TIMEZONE = "Europe/Vilnius";

/** How far back the session history reaches, and how far ahead the plan. */
const HISTORY_DAYS = 70;
const PLAN_DAYS = 13;

type WorkoutKey =
  | "lower"
  | "upper"
  | "threshold"
  | "zone2"
  | "emom"
  | "hyroxSim"
  | "stations";

type DemoItem = {
  exercise?: string;
  customName?: string;
  sets?: number;
  volumeType?: (typeof VOLUME_TYPES)[number];
  volumeValue?: number;
  targetType?: (typeof TARGET_TYPES)[number];
  targetValue?: number;
  targetPreset?: (typeof TARGET_PRESETS)[number];
  weightKg?: number;
  restSeconds?: number;
  notes?: string;
};

type DemoBlock = {
  title?: string;
  blockType: (typeof BLOCK_TYPES)[number];
  durationSeconds?: number;
  rounds?: number;
  workSeconds?: number;
  restSeconds?: number;
  intervalSeconds?: number;
  items: DemoItem[];
};

export type DemoWorkout = {
  key: WorkoutKey;
  title: string;
  description: string;
  primaryType: (typeof WORKOUT_PRIMARY_TYPES)[number];
  difficulty: (typeof WORKOUT_DIFFICULTIES)[number];
  estimatedDurationMinutes: number;
  tags: string[];
  isFavorite: boolean;
  /** Typical active time when finished through Start, before jitter. */
  baseDurationSeconds: number;
  blocks: DemoBlock[];
};

// Units are the database's: seconds, metres, kg, seconds per km.
export const DEMO_WORKOUTS: DemoWorkout[] = [
  {
    key: "lower",
    title: "Lower Body Strength",
    description: "Heavy squats and hinges, then single-leg work for the sled and lunges.",
    primaryType: "strength",
    difficulty: "medium",
    estimatedDurationMinutes: 60,
    tags: ["Gym", "Power"],
    isFavorite: false,
    baseDurationSeconds: 3600,
    blocks: [
      {
        title: "Warm-up",
        blockType: "general",
        items: [{ exercise: "Row Erg", sets: 1, volumeType: "duration", volumeValue: 300, targetPreset: "recovery" }],
      },
      {
        title: "Main lifts",
        blockType: "general",
        items: [
          { exercise: "Back Squat", sets: 5, volumeType: "reps", volumeValue: 5, weightKg: 100, restSeconds: 150 },
          { exercise: "Romanian Deadlift", sets: 4, volumeType: "reps", volumeValue: 8, weightKg: 80, restSeconds: 120 },
        ],
      },
      {
        title: "Accessories",
        blockType: "general",
        items: [
          { exercise: "Bulgarian Split Squat", sets: 3, volumeType: "reps", volumeValue: 10, weightKg: 16, restSeconds: 60, notes: "Per leg, dumbbells in each hand." },
          { exercise: "Walking Lunges", sets: 3, volumeType: "distance", volumeValue: 20, weightKg: 20, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    key: "upper",
    title: "Upper Body Strength",
    description: "Press and pull strength to keep the ski erg and wall balls honest.",
    primaryType: "strength",
    difficulty: "medium",
    estimatedDurationMinutes: 55,
    tags: ["Gym"],
    isFavorite: false,
    baseDurationSeconds: 3300,
    blocks: [
      {
        title: "Main lifts",
        blockType: "general",
        items: [
          { exercise: "Bench Press", sets: 5, volumeType: "reps", volumeValue: 5, weightKg: 77.5, restSeconds: 150 },
          { exercise: "Pull-Ups", sets: 4, volumeType: "reps", volumeValue: 8, restSeconds: 90 },
          { exercise: "Overhead Press", sets: 4, volumeType: "reps", volumeValue: 6, weightKg: 47.5, restSeconds: 120 },
        ],
      },
      {
        title: "Accessories",
        blockType: "general",
        items: [
          { exercise: "Barbell Row", sets: 3, volumeType: "reps", volumeValue: 10, weightKg: 60, restSeconds: 90 },
          { exercise: "Dips", sets: 3, volumeType: "reps", volumeValue: 12, restSeconds: 60 },
        ],
      },
    ],
  },
  {
    key: "threshold",
    title: "Threshold Intervals 5 × 1 km",
    description: "Comfortably hard repeats at threshold pace.",
    primaryType: "running",
    difficulty: "high",
    estimatedDurationMinutes: 50,
    tags: ["Intervals", "Speed"],
    isFavorite: true,
    baseDurationSeconds: 2900,
    blocks: [
      {
        title: "Warm-up",
        blockType: "general",
        items: [{ exercise: "Run", sets: 1, volumeType: "distance", volumeValue: 2000, targetPreset: "zone2" }],
      },
      {
        title: "Intervals",
        blockType: "general",
        items: [{ exercise: "Run", sets: 5, volumeType: "distance", volumeValue: 1000, targetType: "pace_km", targetValue: 255, restSeconds: 90 }],
      },
      {
        title: "Cool-down",
        blockType: "general",
        items: [{ exercise: "Run", sets: 1, volumeType: "distance", volumeValue: 1500, targetPreset: "recovery" }],
      },
    ],
  },
  {
    key: "zone2",
    title: "Zone 2 Long Run",
    description: "Easy aerobic volume. Should feel conversational the whole way.",
    primaryType: "running",
    difficulty: "low",
    estimatedDurationMinutes: 60,
    tags: ["Endurance"],
    isFavorite: false,
    baseDurationSeconds: 3600,
    blocks: [
      {
        blockType: "general",
        items: [{ exercise: "Run", sets: 1, volumeType: "duration", volumeValue: 3600, targetPreset: "zone2" }],
      },
    ],
  },
  {
    key: "emom",
    title: "EMOM Engine 24",
    description: "Four stations, one per minute, six rounds.",
    primaryType: "conditioning",
    difficulty: "high",
    estimatedDurationMinutes: 30,
    tags: ["Intervals", "Power"],
    isFavorite: false,
    baseDurationSeconds: 1500,
    blocks: [
      {
        title: "Station rotation",
        blockType: "emom",
        intervalSeconds: 60,
        rounds: 24,
        items: [
          { exercise: "Row Erg", sets: 1, volumeType: "calories", volumeValue: 15 },
          { exercise: "Wall Balls", sets: 1, volumeType: "reps", volumeValue: 15, weightKg: 6 },
          { exercise: "Assault Bike", sets: 1, volumeType: "calories", volumeValue: 12 },
          { exercise: "Burpees", sets: 1, volumeType: "reps", volumeValue: 12 },
        ],
      },
    ],
  },
  {
    key: "hyroxSim",
    title: "HYROX Half Simulation",
    description: "Four runs and four stations at race weights, for time.",
    primaryType: "hyrox",
    difficulty: "high",
    estimatedDurationMinutes: 45,
    tags: ["Race Prep", "Benchmark"],
    isFavorite: true,
    baseDurationSeconds: 2700,
    blocks: [
      {
        title: "Race block",
        blockType: "for_time",
        items: [
          { exercise: "Run", sets: 1, volumeType: "distance", volumeValue: 1000, targetPreset: "race_pace" },
          { exercise: "Ski Erg", sets: 1, volumeType: "distance", volumeValue: 1000 },
          { exercise: "Run", sets: 1, volumeType: "distance", volumeValue: 1000, targetPreset: "race_pace" },
          { exercise: "Sled Push", sets: 1, volumeType: "distance", volumeValue: 50, weightKg: 152 },
          { exercise: "Run", sets: 1, volumeType: "distance", volumeValue: 1000, targetPreset: "race_pace" },
          { exercise: "Burpee Broad Jumps", sets: 1, volumeType: "distance", volumeValue: 80 },
          { exercise: "Run", sets: 1, volumeType: "distance", volumeValue: 1000, targetPreset: "race_pace" },
          { exercise: "Wall Balls", sets: 1, volumeType: "reps", volumeValue: 100, weightKg: 6 },
        ],
      },
    ],
  },
  {
    key: "stations",
    title: "Station Practice",
    description: "Heavy carries and sled work on a work/rest clock, then wall balls.",
    primaryType: "hyrox",
    difficulty: "medium",
    estimatedDurationMinutes: 40,
    tags: ["Technique", "Race Prep"],
    isFavorite: false,
    baseDurationSeconds: 2400,
    blocks: [
      {
        title: "Carries and sled",
        blockType: "on_off",
        workSeconds: 240,
        restSeconds: 60,
        rounds: 4,
        items: [
          { exercise: "Sled Pull", sets: 1, volumeType: "distance", volumeValue: 25, weightKg: 103 },
          { exercise: "Farmers Carry", sets: 1, volumeType: "distance", volumeValue: 100, weightKg: 24, notes: "24 kg per hand." },
          { exercise: "Sandbag Lunges", sets: 1, volumeType: "distance", volumeValue: 50, weightKg: 20 },
        ],
      },
      {
        title: "Finisher",
        blockType: "general",
        items: [{ exercise: "Wall Balls", sets: 3, volumeType: "reps", volumeValue: 25, weightKg: 6, restSeconds: 60 }],
      },
    ],
  },
];

/**
 * Turns a demo workout into the raw payload the builder would submit, so
 * the seed can run it through validateBuilderPayload like any other save.
 * Throws on a name missing from the catalog — a seed typo, not user error.
 */
export function toBuilderPayload(
  workout: DemoWorkout,
  exerciseIdByName: Map<string, string>,
  tagIdByName: Map<string, string>
): RawBuilderPayload {
  const lookup = (map: Map<string, string>, name: string, kind: string) => {
    const id = map.get(name);
    if (!id) throw new Error(`Unknown ${kind} "${name}" in demo workout "${workout.title}".`);
    return id;
  };

  return {
    title: workout.title,
    description: workout.description,
    primaryType: workout.primaryType,
    difficulty: workout.difficulty,
    estimatedDurationMinutes: workout.estimatedDurationMinutes,
    tagIds: workout.tags.map((name) => lookup(tagIdByName, name, "tag")),
    blocks: workout.blocks.map((block) => ({
      title: block.title ?? null,
      blockType: block.blockType,
      durationSeconds: block.durationSeconds ?? null,
      rounds: block.rounds ?? null,
      workSeconds: block.workSeconds ?? null,
      restSeconds: block.restSeconds ?? null,
      intervalSeconds: block.intervalSeconds ?? null,
      items: block.items.map((item) => ({
        exerciseId: item.exercise ? lookup(exerciseIdByName, item.exercise, "exercise") : null,
        customName: item.customName ?? null,
        sets: item.sets ?? 1,
        volumeType: item.volumeType ?? null,
        volumeValue: item.volumeValue ?? null,
        targetType: item.targetType ?? null,
        targetValue: item.targetValue ?? null,
        targetPreset: item.targetPreset ?? null,
        weightKg: item.weightKg ?? null,
        restSeconds: item.restSeconds ?? null,
        notes: item.notes ?? null,
      })),
    })),
  };
}

// --- Schedule and sessions -------------------------------------------------

/** Deterministic PRNG (mulberry32), so two seeds on the same day match. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PatternEntry = { workout: WorkoutKey; time: string; unplanned?: boolean };

/** The weekly rhythm the demo athlete follows. `week` is 0 for this week,
 * negative for past weeks, so the alternating days rotate over time. */
function patternFor(date: string, week: number): PatternEntry | null {
  switch (getIsoWeekday(date)) {
    case 1:
      return { workout: "lower", time: "18:30" };
    case 2:
      return { workout: "threshold", time: "07:00" };
    case 4:
      return { workout: week % 2 === 0 ? "upper" : "emom", time: "18:30" };
    case 6:
      return { workout: week % 3 === 0 ? "hyroxSim" : "stations", time: "10:00" };
    case 7:
      // Sunday runs happen without a plan — the app backfills an entry.
      return { workout: "zone2", time: "09:00", unplanned: true };
    default:
      return null;
  }
}

export type PastEntry = {
  date: string;
  time: string;
  workout: WorkoutKey;
  /** done = finished through Start (timed); markedDone = Mark done (no
   * duration, stamped at noon); skipped = planned, never done; unplanned =
   * finished with no plan, so the app backfills an entry. */
  kind: "done" | "markedDone" | "skipped" | "unplanned";
  durationSeconds: number | null;
};

export type PlannedEntry = { date: string; time: string; workout: WorkoutKey };

export function buildDemoSchedule(today: string): {
  past: PastEntry[];
  planned: PlannedEntry[];
} {
  const random = createRandom(20260601);
  const baseDuration = new Map(DEMO_WORKOUTS.map((w) => [w.key, w.baseDurationSeconds]));
  const weekOf = (date: string) =>
    Math.floor(diffInDays(getMondayOfWeek(today), getMondayOfWeek(date)) / 7);
  const jitteredDuration = (workout: WorkoutKey) =>
    Math.round((baseDuration.get(workout)! * (0.9 + random() * 0.2)) / 10) * 10;

  const past: PastEntry[] = [];
  for (let offset = -HISTORY_DAYS; offset <= -1; offset++) {
    const date = addDays(today, offset);
    const entry = patternFor(date, weekOf(date));
    const roll = random();

    if (!entry) {
      // The odd extra easy run on a rest day.
      if (getIsoWeekday(date) === 3 && roll < 0.15) {
        past.push({ date, time: "07:30", workout: "zone2", kind: "unplanned", durationSeconds: 2400 });
      }
      continue;
    }

    if (entry.unplanned) {
      if (roll < 0.7) {
        past.push({ ...entry, date, kind: "unplanned", durationSeconds: jitteredDuration(entry.workout) });
      }
      continue;
    }

    if (roll < 0.08) {
      past.push({ ...entry, date, kind: "skipped", durationSeconds: null });
    } else if (roll < 0.25) {
      past.push({ ...entry, date, kind: "markedDone", durationSeconds: null });
    } else {
      past.push({ ...entry, date, kind: "done", durationSeconds: jitteredDuration(entry.workout) });
    }
  }

  const planned: PlannedEntry[] = [];
  // Today always has something open, so Home's TODAY card is never empty.
  const todayEntry = patternFor(today, 0) ?? { workout: "emom" as const, time: "18:00" };
  planned.push({ date: today, time: todayEntry.time, workout: todayEntry.workout });
  for (let offset = 1; offset <= PLAN_DAYS; offset++) {
    const date = addDays(today, offset);
    const entry = patternFor(date, weekOf(date));
    if (entry) planned.push({ date, time: entry.time, workout: entry.workout });
  }

  return { past, planned };
}

/** HH:MM plus a number of seconds, as HH:MM — the moment a session ended. */
export function addSecondsToClock(time: string, seconds: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(h * 60 + m + Math.round(seconds / 60), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// --- Profile data ----------------------------------------------------------

export type DemoRecord = {
  exercise?: string;
  customName?: string;
  recordType: (typeof PERSONAL_RECORD_TYPES)[number];
  value: number;
  daysAgo: number;
};

export const DEMO_RECORDS: DemoRecord[] = [
  { exercise: "Back Squat", recordType: "weight", value: 95, daysAgo: 68 },
  { exercise: "Back Squat", recordType: "weight", value: 100, daysAgo: 40 },
  { exercise: "Back Squat", recordType: "weight", value: 105, daysAgo: 12 },
  { exercise: "Deadlift", recordType: "weight", value: 130, daysAgo: 60 },
  { exercise: "Deadlift", recordType: "weight", value: 140, daysAgo: 25 },
  { exercise: "Bench Press", recordType: "weight", value: 72.5, daysAgo: 55 },
  { exercise: "Bench Press", recordType: "weight", value: 77.5, daysAgo: 20 },
  { exercise: "Pull-Ups", recordType: "reps", value: 14, daysAgo: 50 },
  { exercise: "Pull-Ups", recordType: "reps", value: 17, daysAgo: 14 },
  { customName: "5 km run", recordType: "time", value: 1335, daysAgo: 63 },
  { customName: "5 km run", recordType: "time", value: 1298, daysAgo: 35 },
  { customName: "5 km run", recordType: "time", value: 1271, daysAgo: 9 },
  { customName: "1000 m row", recordType: "time", value: 222, daysAgo: 45 },
  { customName: "1000 m row", recordType: "time", value: 216, daysAgo: 16 },
];

export type DemoMetric = {
  metricType: (typeof BODY_METRIC_TYPES)[number];
  value: number;
  daysAgo: number;
};

export function buildDemoMetrics(): DemoMetric[] {
  const random = createRandom(7);
  const metrics: DemoMetric[] = [];
  const round = (value: number, decimals: number) =>
    Math.round(value * 10 ** decimals) / 10 ** decimals;

  // Weight about twice a week, drifting from ~81.6 to ~79.8 kg.
  for (let daysAgo = 70; daysAgo >= 1; daysAgo -= 3 + Math.floor(random() * 2)) {
    const trend = 79.8 + (1.8 * daysAgo) / 70;
    metrics.push({ metricType: "weight", value: round(trend + (random() - 0.5) * 0.6, 1), daysAgo });
  }
  // Body fat every two weeks, resting HR weekly.
  for (let daysAgo = 70; daysAgo >= 1; daysAgo -= 14) {
    metrics.push({ metricType: "body_fat", value: round(15.6 + (1.6 * daysAgo) / 70, 1), daysAgo });
  }
  for (let daysAgo = 70; daysAgo >= 1; daysAgo -= 7) {
    metrics.push({ metricType: "resting_hr", value: Math.round(52 + (5 * daysAgo) / 70 + (random() - 0.5) * 2), daysAgo });
  }
  return metrics;
}

/** Raw goal input, shaped like the Add goal form's submission. `startFrom`
 * names where a decrease goal's start value comes from: the app captures
 * it at creation, so the seed takes the earliest value of the same series,
 * as if the goal had been set when the history began. */
export type DemoGoal = {
  raw: {
    title: string;
    goalType: string;
    direction: string;
    period: string;
    targetValue: string;
    targetPrimaryType?: string;
    targetMetricType?: string;
    targetExercise?: string;
    targetCustomName?: string;
    targetRecordType?: string;
  };
  startFrom?: "firstWeight" | "first5k";
  isArchived?: boolean;
};

export const DEMO_GOALS: DemoGoal[] = [
  { raw: { title: "Train four times a week", goalType: "session_count", direction: "increase", period: "week", targetValue: "4" } },
  { raw: { title: "Squat 120 kg", goalType: "personal_record", direction: "increase", period: "all_time", targetValue: "120", targetExercise: "Back Squat", targetRecordType: "weight" } },
  { raw: { title: "Sub-20 5 km", goalType: "personal_record", direction: "decrease", period: "all_time", targetValue: "1200", targetCustomName: "5 km run", targetRecordType: "time" }, startFrom: "first5k" },
  { raw: { title: "Race weight 78 kg", goalType: "body_metric", direction: "decrease", period: "all_time", targetValue: "78", targetMetricType: "weight" }, startFrom: "firstWeight" },
  { raw: { title: "Bench press 75 kg", goalType: "personal_record", direction: "increase", period: "all_time", targetValue: "75", targetExercise: "Bench Press", targetRecordType: "weight" }, isArchived: true },
];

export type DemoEvent = {
  title: string;
  eventType: (typeof EVENT_TYPES)[number];
  daysFromToday: number;
  time: string | null;
  location: string | null;
  notes: string | null;
};

export const DEMO_EVENTS: DemoEvent[] = [
  { title: "5 km time trial", eventType: "test", daysFromToday: 12, time: null, location: "Ąžuolynas park, Kaunas", notes: "Check progress toward sub-20." },
  { title: "HYROX race", eventType: "race", daysFromToday: 38, time: "10:30", location: "Vilnius", notes: "Open division. Target: under 1:25." },
  { title: "Half marathon", eventType: "race", daysFromToday: -30, time: "09:00", location: "Kaunas", notes: null },
];

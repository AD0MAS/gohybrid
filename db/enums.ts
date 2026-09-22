// The value list of every Postgres enum, as plain `as const` tuples with no
// imports. db/schema.ts builds each pgEnum from these; anything that runs in
// the browser (client components, validators shared with them) imports the
// tuple from here, never the pgEnum from db/schema.ts, so a client bundle
// does not pull the table definitions in with it.

export const EXERCISE_CATEGORIES = ["exercise", "run", "rest"] as const;

export const WORKOUT_PRIMARY_TYPES = [
  "running",
  "strength",
  "hyrox",
  "conditioning",
  "other",
] as const;

export const WORKOUT_DIFFICULTIES = ["low", "medium", "high"] as const;

export const BLOCK_TYPES = [
  "for_time",
  "on_off",
  "amrap",
  "emom",
  "general",
] as const;

export const VOLUME_TYPES = ["duration", "distance", "reps", "calories"] as const;

export const TARGET_TYPES = [
  "pace_500m",
  "pace_km",
  "cal_per_hour",
  "watts",
  "rpe",
] as const;

export const TARGET_PRESETS = [
  "threshold",
  "race_pace",
  "zone2",
  "tempo",
  "recovery",
] as const;

export const TAG_COLORS = [
  "red",
  "orange",
  "green",
  "blue",
  "purple",
  "gray",
] as const;

export const BODY_METRIC_TYPES = ["weight", "body_fat", "resting_hr"] as const;

export const PERSONAL_RECORD_TYPES = [
  "weight",
  "time",
  "reps",
  "distance",
  "calories",
] as const;

export const GOAL_TYPES = [
  "session_count",
  "streak",
  "body_metric",
  "personal_record",
] as const;

export const GOAL_DIRECTIONS = ["increase", "decrease"] as const;

export const GOAL_PERIODS = ["week", "month", "all_time"] as const;

export const EVENT_TYPES = ["race", "competition", "test", "other"] as const;

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;

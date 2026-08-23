import { relations } from "drizzle-orm";
import {
  pgSchema,
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  index,
} from "drizzle-orm/pg-core";

// Not managed by drizzle-kit (schemaFilter is ["public"]) — declared only
// as an FK target for Supabase's auth.users table.
const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const exerciseCategoryEnum = pgEnum("exercise_category", [
  "exercise",
  "run",
  "rest",
]);

export const workoutPrimaryTypeEnum = pgEnum("workout_primary_type", [
  "running",
  "strength",
  "hyrox",
  "conditioning",
  "other",
]);

export const workoutDifficultyEnum = pgEnum("workout_difficulty", [
  "low",
  "medium",
  "high",
]);

export const blockTypeEnum = pgEnum("block_type", [
  "for_time",
  "on_off",
  "amrap",
  "emom",
  "general",
]);

export const volumeTypeEnum = pgEnum("volume_type", [
  "duration",
  "distance",
  "reps",
  "calories",
]);

export const targetTypeEnum = pgEnum("target_type", [
  "pace_500m",
  "cal_per_hour",
  "watts",
  "rpe",
]);

export const targetPresetEnum = pgEnum("target_preset", [
  "threshold",
  "race_pace",
  "zone2",
  "easy",
  "tempo",
  "recovery",
]);

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  equipment: text("equipment"),
  category: exerciseCategoryEnum("category").notNull().default("exercise"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    primaryType: workoutPrimaryTypeEnum("primary_type").notNull(),
    difficulty: workoutDifficultyEnum("difficulty").notNull(),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workouts_user_id_primary_type_idx").on(
      table.userId,
      table.primaryType
    ),
  ]
);

export const workoutBlocks = pgTable(
  "workout_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    title: text("title"),
    sortOrder: integer("sort_order").notNull(),
    blockType: blockTypeEnum("block_type").notNull(),
    durationSeconds: integer("duration_seconds"),
    rounds: integer("rounds"),
    workSeconds: integer("work_seconds"),
    restSeconds: integer("rest_seconds"),
    intervalSeconds: integer("interval_seconds"),
  },
  (table) => [
    index("workout_blocks_workout_id_sort_order_idx").on(
      table.workoutId,
      table.sortOrder
    ),
  ]
);

export const workoutItems = pgTable(
  "workout_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => workoutBlocks.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    customName: text("custom_name"),
    notes: text("notes"),
    sets: integer("sets").notNull().default(1),
    volumeType: volumeTypeEnum("volume_type"),
    volumeValue: numeric("volume_value", { precision: 6, scale: 2 }),
    targetType: targetTypeEnum("target_type"),
    targetValue: numeric("target_value", { precision: 6, scale: 2 }),
    targetPreset: targetPresetEnum("target_preset"),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }),
    restSeconds: integer("rest_seconds"),
  },
  (table) => [
    index("workout_items_block_id_sort_order_idx").on(
      table.blockId,
      table.sortOrder
    ),
  ]
);

// Relations enable nested db.query reads (e.g. a workout with its blocks
// and each block's items); they don't affect the generated SQL migrations.
export const exercisesRelations = relations(exercises, ({ many }) => ({
  items: many(workoutItems),
}));

export const workoutsRelations = relations(workouts, ({ many }) => ({
  blocks: many(workoutBlocks),
}));

export const workoutBlocksRelations = relations(
  workoutBlocks,
  ({ one, many }) => ({
    workout: one(workouts, {
      fields: [workoutBlocks.workoutId],
      references: [workouts.id],
    }),
    items: many(workoutItems),
  })
);

export const workoutItemsRelations = relations(workoutItems, ({ one }) => ({
  block: one(workoutBlocks, {
    fields: [workoutItems.blockId],
    references: [workoutBlocks.id],
  }),
  exercise: one(exercises, {
    fields: [workoutItems.exerciseId],
    references: [exercises.id],
  }),
}));

export const workoutSessions = pgTable(
  "workout_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workouts.id, {
      onDelete: "set null",
    }),
    workoutTitle: text("workout_title").notNull(),
    workoutPrimaryType: workoutPrimaryTypeEnum("workout_primary_type").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workout_sessions_user_id_completed_at_idx").on(
      table.userId,
      table.completedAt
    ),
  ]
);

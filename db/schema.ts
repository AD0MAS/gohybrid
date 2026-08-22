import {
  pgSchema,
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
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

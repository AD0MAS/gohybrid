import { relations } from "drizzle-orm";
import {
  pgSchema,
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  time,
  integer,
  boolean,
  numeric,
  index,
  primaryKey,
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

export const tagColorEnum = pgEnum("tag_color", [
  "red",
  "orange",
  "green",
  "blue",
  "purple",
  "gray",
]);

export const bodyMetricTypeEnum = pgEnum("body_metric_type", [
  "weight",
  "body_fat",
  "resting_hr",
]);

export const personalRecordTypeEnum = pgEnum("personal_record_type", [
  "weight",
  "time",
  "reps",
  "distance",
  "calories",
]);

export const goalTypeEnum = pgEnum("goal_type", [
  "session_count",
  "streak",
  "body_metric",
  "personal_record",
]);

export const goalDirectionEnum = pgEnum("goal_direction", [
  "increase",
  "decrease",
]);

export const goalPeriodEnum = pgEnum("goal_period", [
  "week",
  "month",
  "all_time",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "race",
  "competition",
  "test",
  "other",
]);

export const unitSystemEnum = pgEnum("unit_system", ["metric", "imperial"]);

export const exercises = pgTable("exercises", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  equipment: text("equipment"),
  category: exerciseCategoryEnum("category").notNull().default("exercise"),
  // Drives the distance-display rule in lib/units.ts: an official HYROX
  // station's distance is always shown in metres, never converted to
  // imperial, because the event itself is defined in metric worldwide. A
  // column rather than a hardcoded name list in lib/ for the same reason
  // `category` exists (GOHYBRID_PLAN.md §7) — renaming an exercise must
  // not silently change display behaviour.
  isHyroxStation: boolean("is_hyrox_station").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// System-wide catalog, not user-created — same shape as exercises. No
// user_id column; add one only if per-user tags become a real requirement.
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  color: tagColorEnum("color").notNull(),
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
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("workouts_user_id_primary_type_idx").on(
      table.userId,
      table.primaryType
    ),
  ]
);

// Many-to-many join table, not a Postgres array column on workouts — an
// array can't carry a foreign key, so deleting a tag would leave dangling
// ids behind instead of cascading.
export const workoutTags = pgTable(
  "workout_tags",
  {
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.workoutId, table.tagId] })]
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
  workoutTags: many(workoutTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  workoutTags: many(workoutTags),
}));

export const workoutTagsRelations = relations(workoutTags, ({ one }) => ({
  workout: one(workouts, {
    fields: [workoutTags.workoutId],
    references: [workouts.id],
  }),
  tag: one(tags, {
    fields: [workoutTags.tagId],
    references: [tags.id],
  }),
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

// A planned occurrence of a workout on a calendar day. Points at its
// workout_session via a nullable session_id rather than the other way
// round — the plan owns the state, and workout_sessions stays an
// independent record that knows nothing about scheduling. No status enum:
// completed is derived from session_id IS NOT NULL, skipped is its own
// boolean, and planned is neither — same reasoning as workout_sessions
// having no status field (GOHYBRID_PLAN.md §5/§6).
export const scheduledWorkouts = pgTable(
  "scheduled_workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    // date, not timestamptz — a scheduled workout is a calendar day, not an
    // instant. Storing it as timestamptz would mean midnight in the user's
    // timezone could land on the previous UTC day.
    scheduledDate: date("scheduled_date").notNull(),
    // Optional — "no specific time" is a normal, common state, not a
    // missing value. Purely informational: never part of session-linking
    // (see linkScheduledWorkoutForDateToSession in lib/scheduled-workouts.ts).
    scheduledTime: time("scheduled_time"),
    sessionId: uuid("session_id").references(() => workoutSessions.id, {
      onDelete: "set null",
    }),
    isSkipped: boolean("is_skipped").notNull().default(false),
    // True for a row created by finishWorkout to represent an unplanned
    // workout that had no matching scheduled entry, rather than one the
    // user actually planned. Distinguishes the two so deleting the linked
    // session (lib/sessions.ts) can delete this row along with it instead
    // of reverting it to Planned via ON DELETE SET NULL — a backfilled row
    // has no meaning once the session it stands in for is gone.
    isBackfilled: boolean("is_backfilled").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("scheduled_workouts_user_id_scheduled_date_idx").on(
      table.userId,
      table.scheduledDate
    ),
  ]
);

export const scheduledWorkoutsRelations = relations(
  scheduledWorkouts,
  ({ one }) => ({
    workout: one(workouts, {
      fields: [scheduledWorkouts.workoutId],
      references: [workouts.id],
    }),
    session: one(workoutSessions, {
      fields: [scheduledWorkouts.sessionId],
      references: [workoutSessions.id],
    }),
  })
);

// A single measurement (weight, body fat %, resting HR), always in
// metric/SI units — unit conversion is a Layer 4 Settings UI concern, not
// a DB one (GOHYBRID_PLAN.md §5 Layer 4). No unique constraint on
// (user_id, metric_type, measured_at): two weigh-ins on the same day are
// legitimate. measured_at is `date`, not timestamptz — a measurement is a
// calendar day, not an instant, same reasoning as scheduled_date (§6A).
export const bodyMetrics = pgTable(
  "body_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    metricType: bodyMetricTypeEnum("metric_type").notNull(),
    value: numeric("value", { precision: 6, scale: 2 }).notNull(),
    measuredAt: date("measured_at").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("body_metrics_user_id_metric_type_measured_at_idx").on(
      table.userId,
      table.metricType,
      table.measuredAt
    ),
  ]
);

// A manually entered personal record, kept as history rather than a single
// current value — the current best per subject is derived (see
// isBetterRecord/groupPersonalRecordsBySubject in lib/personal-records.ts).
// exercise_id + custom_name mirrors workout_items exactly (GOHYBRID_PLAN.md
// §6): a record either points at the catalog or carries its own name,
// neither required at the DB level — "at least one" is application-level
// validation, same as everywhere else in this schema. numeric(9,2) rather
// than the (6,2) body_metrics uses: time records are stored in seconds and
// a marathon finish exceeds 9999.99. achieved_at is `date`, not
// timestamptz — a PR is a calendar day, same reasoning as measured_at.
export const personalRecords = pgTable(
  "personal_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    customName: text("custom_name"),
    recordType: personalRecordTypeEnum("record_type").notNull(),
    value: numeric("value", { precision: 9, scale: 2 }).notNull(),
    achievedAt: date("achieved_at").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("personal_records_user_id_achieved_at_idx").on(
      table.userId,
      table.achievedAt
    ),
  ]
);

export const personalRecordsRelations = relations(
  personalRecords,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [personalRecords.exerciseId],
      references: [exercises.id],
    }),
  })
);

// A user-defined target tracked against one of four sources. The five
// target_* columns follow the same per-type pattern as workout_blocks'
// duration_seconds/rounds/work_seconds/rest_seconds/interval_seconds: each
// is filled only for its own goal_type, and which ones a given goal_type
// requires is application-level validation (lib/goals-validation.ts), not a
// DB constraint (GOHYBRID_PLAN.md §6). direction is stored here even though
// personal_records derives an equivalent direction from record_type
// (isBetterRecord in lib/personal-records.ts) — the same metric can be a
// goal in either direction (lose weight vs. gain weight), so for goals it's
// a user choice, not a property of the data. No is_completed column: a goal
// is achieved when its computed progress reaches 100%, the same reasoning
// as workout_sessions having no status field; is_archived is a separate,
// user-driven action, not derived from progress.
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    goalType: goalTypeEnum("goal_type").notNull(),
    direction: goalDirectionEnum("direction").notNull(),
    period: goalPeriodEnum("period").notNull(),
    targetValue: numeric("target_value", { precision: 9, scale: 2 }).notNull(),
    startValue: numeric("start_value", { precision: 9, scale: 2 }),
    targetPrimaryType: workoutPrimaryTypeEnum("target_primary_type"),
    targetMetricType: bodyMetricTypeEnum("target_metric_type"),
    targetExerciseId: uuid("target_exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    targetCustomName: text("target_custom_name"),
    targetRecordType: personalRecordTypeEnum("target_record_type"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("goals_user_id_is_archived_idx").on(table.userId, table.isArchived),
  ]
);

export const goalsRelations = relations(goals, ({ one }) => ({
  exercise: one(exercises, {
    fields: [goals.targetExerciseId],
    references: [exercises.id],
  }),
}));

// An upcoming or past race/competition/test a user wants a countdown or
// record for. event_date is `date`, not timestamptz — an event is a
// calendar day, same reasoning as scheduled_workouts.scheduled_date (§6A)
// and personal_records.achieved_at. No is_completed/is_past column: an
// event is past once event_date < today, same reasoning as
// workout_sessions having no status field and goals having no
// is_completed column. No FK to goals or scheduled_workouts — linking them
// would add a column that changes nothing about how either behaves (§6,
// "no field just in case").
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventDate: date("event_date").notNull(),
    eventType: eventTypeEnum("event_type").notNull(),
    location: text("location"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_user_id_event_date_idx").on(table.userId, table.eventDate),
  ]
);

// Per-user Settings (GOHYBRID_PLAN.md §5 Layer 4): timezone and unit
// system. user_id is itself the primary key rather than a separate `id` —
// there's exactly one row per user, so a second identity column would only
// duplicate the uniqueness the FK already gives it. timezone is `text`,
// not an enum — there are hundreds of IANA zones, and validating against
// them belongs in application code (Intl.supportedValuesOf("timeZone"),
// see lib/user-settings-validation.ts), not a hand-maintained Postgres
// enum. unit_system is added now, even though nothing reads it until the
// next Layer 4 step, so this table doesn't need a second migration a few
// days apart from this one. A missing row (no user has saved settings yet)
// is a normal, common state — see DEFAULT_USER_SETTINGS in
// lib/user-settings.ts — not backfilled at registration.
export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Europe/Vilnius"),
  unitSystem: unitSystemEnum("unit_system").notNull().default("metric"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

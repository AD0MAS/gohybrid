process.loadEnvFile(".env.local");

type ExerciseSeed = {
  name: string;
  equipment: string | null;
  category: "exercise" | "run" | "rest";
  // Defaults to false when omitted — only the eight official HYROX
  // stations set this. See exercises.is_hyrox_station in db/schema.ts.
  isHyroxStation?: boolean;
};

type TagSeed = {
  name: string;
  color: "red" | "orange" | "green" | "blue" | "purple" | "gray";
};

// Equipment strings are reused deliberately across exercises that share the
// same piece of kit — they double as the equipment tags on Workout Detail.
const EXERCISES: ExerciseSeed[] = [
  // --- Generic entries (category drives Start Workout Mode behavior) ---
  { name: "Run", equipment: null, category: "run" },
  { name: "Rest", equipment: null, category: "rest" },

  // --- HYROX official stations (all eight set isHyroxStation: true —
  // drives the metric-only distance display rule in lib/units.ts) ---
  { name: "Ski Erg", equipment: "Ski Erg", category: "exercise", isHyroxStation: true },
  { name: "Sled Push", equipment: "Sled", category: "exercise", isHyroxStation: true },
  { name: "Sled Pull", equipment: "Sled", category: "exercise", isHyroxStation: true },
  { name: "Burpee Broad Jumps", equipment: null, category: "exercise", isHyroxStation: true },
  { name: "Row Erg", equipment: "Rower", category: "exercise", isHyroxStation: true },
  { name: "Farmers Carry", equipment: "Kettlebells", category: "exercise", isHyroxStation: true },
  { name: "Sandbag Lunges", equipment: "Sandbag", category: "exercise", isHyroxStation: true },
  { name: "Wall Balls", equipment: "Medicine Ball", category: "exercise", isHyroxStation: true },

  // --- Strength: squat, deadlift, press, lunge, pull variants ---
  { name: "Back Squat", equipment: "Barbell", category: "exercise" },
  { name: "Front Squat", equipment: "Barbell", category: "exercise" },
  { name: "Goblet Squat", equipment: "Kettlebells", category: "exercise" },
  { name: "Deadlift", equipment: "Barbell", category: "exercise" },
  { name: "Romanian Deadlift", equipment: "Barbell", category: "exercise" },
  { name: "Sumo Deadlift", equipment: "Barbell", category: "exercise" },
  { name: "Barbell Row", equipment: "Barbell", category: "exercise" },
  { name: "Hip Thrust", equipment: "Barbell", category: "exercise" },
  { name: "Power Clean", equipment: "Barbell", category: "exercise" },
  { name: "Bench Press", equipment: "Barbell", category: "exercise" },
  { name: "Overhead Press", equipment: "Barbell", category: "exercise" },
  { name: "Push Press", equipment: "Barbell", category: "exercise" },
  {
    name: "Dumbbell Shoulder Press",
    equipment: "Dumbbells",
    category: "exercise",
  },
  { name: "Walking Lunges", equipment: "Dumbbells", category: "exercise" },
  { name: "Reverse Lunges", equipment: "Dumbbells", category: "exercise" },
  {
    name: "Bulgarian Split Squat",
    equipment: "Dumbbells",
    category: "exercise",
  },

  // --- Conditioning machines ---
  { name: "Assault Bike", equipment: "Assault Bike", category: "exercise" },
  { name: "Echo Bike", equipment: "Echo Bike", category: "exercise" },

  // --- Functional / bodyweight ---
  { name: "Burpees", equipment: null, category: "exercise" },
  { name: "Pull-Ups", equipment: "Pull-Up Bar", category: "exercise" },
  { name: "Push-Ups", equipment: null, category: "exercise" },
  { name: "Box Jumps", equipment: "Box", category: "exercise" },
  { name: "Box Step-Ups", equipment: "Box", category: "exercise" },
  { name: "Air Squats", equipment: null, category: "exercise" },
  { name: "Mountain Climbers", equipment: null, category: "exercise" },
  { name: "Plank", equipment: null, category: "exercise" },
  { name: "Sit-Ups", equipment: null, category: "exercise" },
  { name: "Toes-to-Bar", equipment: "Pull-Up Bar", category: "exercise" },
  { name: "Kettlebell Swings", equipment: "Kettlebells", category: "exercise" },
  { name: "Double Unders", equipment: "Jump Rope", category: "exercise" },
  { name: "Devil's Press", equipment: "Dumbbells", category: "exercise" },
  { name: "Thrusters", equipment: "Barbell", category: "exercise" },
  { name: "Man Makers", equipment: "Dumbbells", category: "exercise" },
  { name: "Battle Ropes", equipment: "Battle Rope", category: "exercise" },
  { name: "Sandbag Carry", equipment: "Sandbag", category: "exercise" },
  { name: "Dips", equipment: "Dip Bars", category: "exercise" },
  { name: "Ring Rows", equipment: "Rings", category: "exercise" },
];

// Colours are grouped by what the tag means, not assigned one-per-tag:
// orange for tempo/high-output work, red for intensity/testing, green for
// easy/rest, purple for skill, blue for aerobic base, gray for location
// context (which carries no intensity meaning at all).
const TAGS: TagSeed[] = [
  { name: "Endurance", color: "blue" },
  { name: "Speed", color: "orange" },
  { name: "Intervals", color: "orange" },
  { name: "Power", color: "red" },
  { name: "Recovery", color: "green" },
  { name: "Technique", color: "purple" },
  { name: "Race Prep", color: "red" },
  { name: "Deload", color: "green" },
  { name: "Benchmark", color: "red" },
  { name: "Home", color: "gray" },
  { name: "Gym", color: "gray" },
];

async function main() {
  const { db } = await import("./index");
  const { sql } = await import("drizzle-orm");
  const { exercises, tags } = await import("./schema");

  // onConflictDoUpdate, not onConflictDoNothing: this seed must be
  // re-runnable, and re-running it after adding is_hyrox_station needs to
  // backfill that column on rows the catalog already had — onConflictDoNothing
  // would silently leave every existing HYROX station's flag at its default
  // (false). `excluded.*` (Postgres's upsert pseudo-table) reuses each row's
  // own new values rather than a single fixed value applied to every match.
  const upsertedExercises = await db
    .insert(exercises)
    .values(
      EXERCISES.map((e) => ({ ...e, isHyroxStation: e.isHyroxStation ?? false }))
    )
    .onConflictDoUpdate({
      target: exercises.name,
      set: {
        equipment: sql`excluded.equipment`,
        category: sql`excluded.category`,
        isHyroxStation: sql`excluded.is_hyrox_station`,
      },
    })
    .returning({ id: exercises.id });

  console.log(`Upserted ${upsertedExercises.length} exercise(s).`);

  const insertedTags = await db
    .insert(tags)
    .values(TAGS)
    .onConflictDoNothing()
    .returning({ id: tags.id });

  console.log(`Inserted ${insertedTags.length} tag(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

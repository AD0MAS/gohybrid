process.loadEnvFile(".env.local");

type ExerciseSeed = {
  name: string;
  equipment: string | null;
  category: "exercise" | "run" | "rest";
};

// Equipment strings are reused deliberately across exercises that share the
// same piece of kit — they double as the equipment tags on Workout Detail.
const EXERCISES: ExerciseSeed[] = [
  // --- Generic entries (category drives Start Workout Mode behavior) ---
  { name: "Run", equipment: null, category: "run" },
  { name: "Rest", equipment: null, category: "rest" },

  // --- HYROX official stations ---
  { name: "Ski Erg", equipment: "Ski Erg", category: "exercise" },
  { name: "Sled Push", equipment: "Sled", category: "exercise" },
  { name: "Sled Pull", equipment: "Sled", category: "exercise" },
  { name: "Burpee Broad Jumps", equipment: null, category: "exercise" },
  { name: "Row Erg", equipment: "Rower", category: "exercise" },
  { name: "Farmers Carry", equipment: "Kettlebells", category: "exercise" },
  { name: "Sandbag Lunges", equipment: "Sandbag", category: "exercise" },
  { name: "Wall Balls", equipment: "Medicine Ball", category: "exercise" },

  // --- Strength: squat, deadlift, press, lunge variants ---
  { name: "Back Squat", equipment: "Barbell", category: "exercise" },
  { name: "Front Squat", equipment: "Barbell", category: "exercise" },
  { name: "Goblet Squat", equipment: "Kettlebells", category: "exercise" },
  { name: "Deadlift", equipment: "Barbell", category: "exercise" },
  { name: "Romanian Deadlift", equipment: "Barbell", category: "exercise" },
  { name: "Sumo Deadlift", equipment: "Barbell", category: "exercise" },
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

async function main() {
  const { db } = await import("./index");
  const { exercises } = await import("./schema");

  const inserted = await db
    .insert(exercises)
    .values(EXERCISES)
    .onConflictDoNothing()
    .returning({ id: exercises.id });

  console.log(`Inserted ${inserted.length} exercise(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

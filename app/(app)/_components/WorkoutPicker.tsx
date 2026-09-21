type WorkoutPickerProps = {
  workouts: readonly { id: string; title: string }[];
  defaultValue?: string;
};

/**
 * Plain workout <select>, for the no-known-workoutId branch of
 * LogPastSessionForm and ScheduleWorkoutForm (Home's quick actions). Unlike ExercisePicker (app/(app)/workouts/builder/
 * ExercisePicker.tsx), a workout has no custom-name duality and no
 * category to group by — a user's own workout list is a small,
 * already-title-sorted set (getWorkoutsForUser(userId, { sort: "title" })),
 * so a plain alphabetical <select> is enough; grouping it the way
 * ExercisePicker groups the exercise catalog would need a concept
 * (workouts.primaryType, tags) that doesn't map onto "which of my own
 * workouts did I do." Deliberately uncontrolled (name="workoutId",
 * defaultValue only) rather than ExercisePicker's controlled value/onChange
 * — nothing else on the form reacts to which workout is chosen, so there's
 * no cross-field state for this component to own. Not a "use client" file
 * itself, same reasoning as ExercisePicker — its caller already is one.
 */
export default function WorkoutPicker({
  workouts,
  defaultValue,
}: WorkoutPickerProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Workout
      <select
        name="workoutId"
        defaultValue={defaultValue ?? ""}
        required
        className="h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        <option value="" disabled>
          Select workout…
        </option>
        {workouts.map((workout) => (
          <option key={workout.id} value={workout.id}>
            {workout.title}
          </option>
        ))}
      </select>
    </label>
  );
}

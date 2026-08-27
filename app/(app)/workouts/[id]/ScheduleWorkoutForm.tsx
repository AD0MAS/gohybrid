"use client";

import { useState, useTransition } from "react";

type ScheduleWorkoutFormProps = {
  scheduleAction: (formData: FormData) => Promise<void>;
};

/**
 * "Schedule this workout" control on the workout detail page: a date
 * picker plus optional time and notes. The workout id is already baked into
 * `scheduleAction` via .bind(null, id) from the (Server Component) page,
 * mirroring FavoriteToggle and DeleteWorkoutModal — the client boundary is
 * limited to the form's own pending/error/success state.
 */
export default function ScheduleWorkoutForm({
  scheduleAction,
}: ScheduleWorkoutFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [isPending, startTransition] = useTransition();

  function formAction(formData: FormData) {
    setError(null);
    setScheduled(false);
    startTransition(async () => {
      try {
        await scheduleAction(formData);
        setScheduled(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't schedule this workout."
        );
      }
    });
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded border border-gray-300 p-5"
    >
      <p className="text-sm font-medium">Schedule this workout</p>

      <label className="flex flex-col gap-1 text-sm">
        Date
        <input
          type="date"
          name="scheduledDate"
          required
          className="h-11 rounded border border-gray-300 px-4 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Time (optional)
        <input
          type="time"
          name="scheduledTime"
          className="h-11 rounded border border-gray-300 px-4 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Notes (optional)
        <input
          type="text"
          name="notes"
          className="h-11 rounded border border-gray-300 px-4 text-base"
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {scheduled && <p className="text-sm text-green-700">Scheduled.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-11 items-center justify-center self-start rounded bg-black px-4 text-base text-white disabled:opacity-50"
      >
        {isPending ? "Scheduling…" : "Schedule"}
      </button>
    </form>
  );
}

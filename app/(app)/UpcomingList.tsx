import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/app/_components/FormStatus";
import { formatRelativeDay } from "@/lib/dates";
import { getUpcomingForUser } from "@/lib/scheduled-workouts";
import { getUserContext } from "@/lib/user-settings";
import { TAG_COLOR_CLASSES } from "./workouts/tag-colors";
import {
  markScheduledWorkoutDone,
  markScheduledWorkoutSkipped,
  unscheduleWorkout,
} from "./upcoming-actions";

type UpcomingListProps = {
  userId: string;
  limit: number;
};

/**
 * Upcoming scheduled workouts: soonest first, each with its workout's
 * title, tags, and controls to mark it skipped or remove it entirely.
 * Reads via getUpcomingForUser, which already excludes skipped entries and
 * ones that already have a linked session — everything rendered here is
 * still a genuinely open plan. Queries the database directly via
 * lib/scheduled-workouts rather than fetching an API route — same
 * reasoning as the /workouts list and detail pages.
 *
 * A reusable component, not a page: Home and
 * Workouts both render this list at a different length, and a dedicated
 * /schedule route would be a third place carrying the same query. It takes
 * `userId` as a prop from the page (same pattern as /stats) rather than
 * calling requireUser() itself, and `limit` so both call sites can render
 * it without threading the query through their own page component.
 */
export default async function UpcomingList({ userId, limit }: UpcomingListProps) {
  const { today } = await getUserContext(userId);
  const upcoming = await getUpcomingForUser(userId, limit);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">Upcoming</h2>

      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          Nothing scheduled yet. Schedule a workout from its detail page.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.map((entry) => (
            <li
              key={entry.id}
              className="relative cursor-pointer rounded-lg border border-hairline bg-surface-1 py-5 pl-5 pr-10 hover:bg-surface-2 has-[a:active]:bg-surface-2"
            >
              <Link
                href={`/workouts/${entry.workout.id}?from=home`}
                className="font-medium text-ink after:absolute after:inset-0 hover:text-accent active:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
              >
                {entry.workout.title}
              </Link>
              <p className="text-sm text-ink-subtle">
                {formatRelativeDay(entry.scheduledDate, today)}
              </p>
              {entry.notes && (
                <p className="text-sm text-ink-subtle">Notes: {entry.notes}</p>
              )}

              {entry.workout.workoutTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.workout.workoutTags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className={`rounded-full border px-3 py-1 text-xs ${TAG_COLOR_CLASSES[tag.color]}`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="relative z-10 mt-2 flex gap-4">
                <form action={markScheduledWorkoutDone.bind(null, entry.id)}>
                  <SubmitButton className="text-sm text-ink-subtle hover:text-ink active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
                    Mark done
                  </SubmitButton>
                </form>
                <form
                  action={markScheduledWorkoutSkipped.bind(null, entry.id, true)}
                >
                  <SubmitButton className="text-sm text-ink-subtle hover:text-ink active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
                    Mark skipped
                  </SubmitButton>
                </form>
                <form action={unscheduleWorkout.bind(null, entry.id)}>
                  <SubmitButton className="text-sm text-ink-subtle hover:text-danger active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus">
                    Remove
                  </SubmitButton>
                </form>
              </div>
              <ChevronRight className="absolute right-5 top-1/2 h-5 w-5 shrink-0 -translate-y-1/2 text-ink-subtle" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

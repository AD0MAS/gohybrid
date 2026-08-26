import { daysUntil, formatCountdown, getNextEventForUser } from "@/lib/events";
import { getUserContext } from "@/lib/user-settings";

type NextEventProps = {
  userId: string;
};

/**
 * Home's one-line next-event countdown (GOHYBRID_PLAN.md §5A/§5 Layer 4):
 * title and countdown only, rendered above the summary cards. Renders
 * nothing at all when there's no upcoming event — Home deliberately shows
 * no empty state here, unlike the Upcoming/Events lists elsewhere, since a
 * user with no events shouldn't see a permanent "no events" line at the
 * very top of their home screen. The countdown is computed from
 * getUserContext()'s `today` and daysUntil (lib/events.ts), never a
 * client-side `new Date()`, which would introduce the user's clock as a
 * second source of truth alongside the database's. daysUntil itself takes
 * no timezone — events.event_date is a `date`, not a `timestamptz`, so
 * it's plain YYYY-MM-DD string arithmetic, same as scheduled_workouts'
 * date handling (GOHYBRID_PLAN.md §6A) — but "today" still has to be the
 * user's own calendar day, via getUserContext, or a user behind or ahead
 * of UTC would see an off-by-one countdown.
 */
export default async function NextEvent({ userId }: NextEventProps) {
  const { today } = await getUserContext(userId);
  const event = await getNextEventForUser(userId, today);

  if (!event) return null;

  return (
    <p className="text-sm text-gray-600">
      {event.title} · {formatCountdown(daysUntil(event.eventDate, today))}
    </p>
  );
}

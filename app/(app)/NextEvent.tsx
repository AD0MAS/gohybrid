import { daysUntil, formatCountdown, getNextEventForUser } from "@/lib/events";
import { getCurrentDateString } from "@/lib/scheduled-workouts";

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
 * getCurrentDateString() and daysUntil (lib/events.ts), never a
 * client-side `new Date()`, which would introduce the user's clock as a
 * third source of truth alongside the DB and APP_TIMEZONE.
 */
export default async function NextEvent({ userId }: NextEventProps) {
  const today = await getCurrentDateString();
  const event = await getNextEventForUser(userId, today);

  if (!event) return null;

  return (
    <p className="text-sm text-gray-600">
      {event.title} · {formatCountdown(daysUntil(event.eventDate, today))}
    </p>
  );
}

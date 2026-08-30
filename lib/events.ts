import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { events, eventTypeEnum } from "@/db/schema";
import { diffInDays } from "./dates";
import type { ValidatedEventInput } from "./events-validation";

export type Event = {
  id: string;
  userId: string;
  title: string;
  eventDate: string;
  eventType: (typeof eventTypeEnum.enumValues)[number];
  location: string | null;
  notes: string | null;
  createdAt: Date;
};

/**
 * Lists `userId`'s upcoming events (event_date >= today), soonest first —
 * the /profile Events section's main list. `userId` is a required first
 * parameter, not read from a session internally — with RLS disabled, this
 * filter is the only thing preventing one user from reading another
 * user's events. `today` comes from the caller (see getUserContext in
 * lib/user-settings.ts — the user's own calendar day), the same ground
 * truth used everywhere else "today" matters, rather than being computed
 * here.
 */
export async function getUpcomingEventsForUser(
  userId: string,
  today: string
): Promise<Event[]> {
  return db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.eventDate, today)))
    .orderBy(asc(events.eventDate));
}

/**
 * Lists `userId`'s past events (event_date < today), most recently first —
 * the /profile Events section's collapsed history, same
 * <details>-disclosure pattern GoalsList uses for archived goals.
 */
export async function getPastEventsForUser(
  userId: string,
  today: string
): Promise<Event[]> {
  return db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), lt(events.eventDate, today)))
    .orderBy(desc(events.eventDate));
}

/**
 * The single soonest upcoming event for `userId`, or null — Home's
 * one-line countdown. A separate function rather than a `limit` parameter
 * on getUpcomingEventsForUser, same reasoning as getRecentSessionsForUser
 * vs getSessionsForUser (GOHYBRID_PLAN.md §7): an optional cap on the full
 * list is one default value away from silently truncating it.
 */
export async function getNextEventForUser(
  userId: string,
  today: string
): Promise<Event | null> {
  const [next] = await db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.eventDate, today)))
    .orderBy(asc(events.eventDate))
    .limit(1);

  return next ?? null;
}

/**
 * Records one event for `userId`. `input` is already validated (see
 * validateEventInput in lib/events-validation.ts).
 */
export async function createEventForUser(
  userId: string,
  input: ValidatedEventInput
): Promise<Event> {
  const [created] = await db
    .insert(events)
    .values({
      userId,
      title: input.title,
      eventDate: input.eventDate,
      eventType: input.eventType,
      location: input.location,
      notes: input.notes,
    })
    .returning();

  return created;
}

/**
 * Updates an event owned by `userId`, returning the updated Event or null if
 * nothing matched — whether because the id doesn't exist or because it
 * belongs to a different user. Ownership is enforced in the WHERE clause,
 * same pattern as deleteEventForUser. `input` is already validated — an
 * update has the same rules as a create (see validateEventInput), and the
 * write shape mirrors createEventForUser's exactly.
 */
export async function updateEventForUser(
  id: string,
  userId: string,
  input: ValidatedEventInput
): Promise<Event | null> {
  const [updated] = await db
    .update(events)
    .set({
      title: input.title,
      eventDate: input.eventDate,
      eventType: input.eventType,
      location: input.location,
      notes: input.notes,
    })
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Deletes an event owned by `userId`, returning true if a row was deleted
 * and false otherwise — whether because the id doesn't exist or because it
 * belongs to a different user. Ownership is enforced in the WHERE clause,
 * same pattern as deletePersonalRecordForUser/deleteBodyMetricForUser.
 */
export async function deleteEventForUser(
  id: string,
  userId: string
): Promise<boolean> {
  const deleted = await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .returning({ id: events.id });

  return deleted.length > 0;
}

/**
 * Whole-day difference between `today` and `eventDate` (both YYYY-MM-DD):
 * positive for a future event, 0 for today, negative for a past one. Built
 * entirely on diffInDays (lib/dates.ts), which is itself Date.UTC string
 * math — the same calendar-day-arithmetic approach the codebase already
 * uses everywhere else (GOHYBRID_PLAN.md §7), rather than a new one. No DB
 * access — same principle as computeStreaks/computeGoalProgress, so the
 * countdown math can be reasoned about and tested on its own.
 */
export function daysUntil(eventDate: string, today: string): number {
  return diffInDays(today, eventDate);
}

/**
 * Formats a daysUntil() result as the short countdown string shown next to
 * an event ("today", "tomorrow", "in 34 days") — pure and reused by both
 * the /profile Events section and Home's next-event line, so the wording
 * can't drift between the two. Only exercised with non-negative values in
 * practice (both call sites only render upcoming events), but handles a
 * negative input the same way for a function that should be reasonable on
 * its own.
 */
export function formatCountdown(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "yesterday";
  return `${Math.abs(days)} days ago`;
}

import type { eventTypeEnum } from "@/db/schema";

type EventType = (typeof eventTypeEnum.enumValues)[number];

/**
 * Display label per event_type enum value — the event-type select and the
 * events list both read from here, same pattern as GOAL_TYPE_LABELS.
 */
export const EVENT_TYPE_LABELS: Record<EventType, { label: string }> = {
  race: { label: "Race" },
  competition: { label: "Competition" },
  test: { label: "Test" },
  other: { label: "Other" },
};

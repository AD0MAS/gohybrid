import { eventTypeEnum } from "@/db/schema";
import { isOneOf } from "./workouts-validation";
import {
  isValidDateString,
  isValidTimeString,
} from "./scheduled-workouts-validation";
import {
  checkTextLength,
  SHORT_TEXT_MAX_LENGTH,
  LONG_TEXT_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from "./text-limits";

export type ValidatedEventInput = {
  title: string;
  eventDate: string;
  eventTime: string | null;
  eventType: (typeof eventTypeEnum.enumValues)[number];
  location: string | null;
  notes: string | null;
};

export type EventValidationResult =
  | { success: true; data: ValidatedEventInput }
  | { success: false; error: string };

/** Raw, untyped event input as received from a FormData submission. */
export type RawEventInput = {
  title?: unknown;
  eventDate?: unknown;
  eventTime?: unknown;
  eventType?: unknown;
  location?: unknown;
  notes?: unknown;
};

/**
 * Validates and normalizes event input, same (input) => result shape as
 * validatePersonalRecordInput/validateBodyMetricInput minus their `today`
 * parameter (same simplification as validateGoalInput in
 * lib/goals-validation.ts) — a personal record or body metric can't
 * predate itself, but an event's date is deliberately unconstrained in
 * both directions, so there's no "not in the future" rule to check today
 * against: a user may log an upcoming race or one they already ran.
 * Rules: title required and trimmed;
 * eventType must be one of the enum values defined in db/schema.ts;
 * eventDate must be a syntactically valid YYYY-MM-DD date; eventTime is
 * optional — empty or absent is null (an all-day event), otherwise it must
 * pass isValidTimeString, the same HH:MM/HH:MM:SS check scheduling uses, with
 * no relation to today (an event may be in the past); location and
 * notes, if present, are trimmed and normalized to null when empty.
 */
export function validateEventInput(input: RawEventInput): EventValidationResult {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return { success: false, error: "Title is required." };
  }
  const titleCheck = checkTextLength(title, NAME_MAX_LENGTH, "Title");
  if (!titleCheck.ok) {
    return { success: false, error: titleCheck.error };
  }

  const eventType = input.eventType;
  if (!isOneOf(eventType, eventTypeEnum.enumValues)) {
    return {
      success: false,
      error: "Choose a valid event type.",
    };
  }

  const eventDate = input.eventDate;
  if (!isValidDateString(eventDate)) {
    return { success: false, error: "Event date must be a valid date." };
  }

  let eventTime: string | null = null;
  if (typeof input.eventTime === "string" && input.eventTime !== "") {
    if (!isValidTimeString(input.eventTime)) {
      return { success: false, error: "Time must be a valid time." };
    }
    eventTime = input.eventTime;
  }

  const location =
    typeof input.location === "string" && input.location.trim() !== ""
      ? input.location.trim()
      : null;
  if (location !== null) {
    const locationCheck = checkTextLength(
      location,
      SHORT_TEXT_MAX_LENGTH,
      "Location"
    );
    if (!locationCheck.ok) {
      return { success: false, error: locationCheck.error };
    }
  }

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;
  if (notes !== null) {
    const notesCheck = checkTextLength(notes, LONG_TEXT_MAX_LENGTH, "Notes");
    if (!notesCheck.ok) {
      return { success: false, error: notesCheck.error };
    }
  }

  return {
    success: true,
    data: { title, eventDate, eventTime, eventType, location, notes },
  };
}

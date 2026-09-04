"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  createEventForUser,
  deleteEventForUser,
  updateEventForUser,
} from "@/lib/events";
import { validateEventInput } from "@/lib/events-validation";
import { echoFormValues } from "@/lib/form-state";

export type EventFormState =
  | { status: "idle" }
  | { status: "error"; error: string; values: Record<string, string> }
  | { status: "success" };

/**
 * Creates a new event for the authenticated user. Passed to useActionState
 * in EventForm, so a validation failure is an expected outcome of a form
 * submission — it returns { status: "error", error } for the form to
 * render, rather than throwing (which would hit app/error.tsx and replace
 * the whole page). { status: "success" } lets the add-event modal tell
 * "nothing has happened yet" apart from "saved", closing itself only once
 * a save actually went through. Genuine unexpected failures (e.g. a DB
 * error from createEventForUser) still throw and belong to the error
 * boundary. Revalidates /profile (the Events section), / (Home's
 * next-event line), /calendar and /workouts (both now render events
 * alongside scheduled workouts — WeekStrip and the month grid) on success.
 */
export async function addEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const user = await requireUser();

  const result = validateEventInput({
    title: formData.get("title"),
    eventDate: formData.get("eventDate"),
    eventType: formData.get("eventType"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      status: "error",
      error: result.error,
      values: echoFormValues(formData),
    };
  }

  await createEventForUser(user.id, result.data);

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/workouts");
  return { status: "success" };
}

/**
 * Updates one of the authenticated user's events, bound with the id via
 * .bind(null, id) so the resulting function matches useActionState's
 * (prevState, formData) signature exactly — same validation as addEvent
 * (an update has the same rules as a create), against EventForm's
 * entry-populated form instead of an empty one. Ownership is enforced by
 * updateEventForUser's WHERE clause; a null result (wrong id or another
 * user's row) throws, same as deleteEvent, since a forged id can't
 * silently no-op. Revalidates /profile, /, /calendar and /workouts on
 * success — same set as addEvent, since WeekStrip's per-row edit trigger
 * calls this too.
 */
export async function updateEvent(
  id: string,
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const user = await requireUser();

  const result = validateEventInput({
    title: formData.get("title"),
    eventDate: formData.get("eventDate"),
    eventType: formData.get("eventType"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      status: "error",
      error: result.error,
      values: echoFormValues(formData),
    };
  }

  const updated = await updateEventForUser(id, user.id, result.data);
  if (!updated) {
    throw new Error("Event not found.");
  }

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/workouts");
  return { status: "success" };
}

/**
 * Deletes one of the authenticated user's events, bound with the id via
 * .bind(null, id) from /profile and, now, from WeekStrip's event cards —
 * same one-click form with no confirmation step either place, since an
 * event delete has no destructive side effect the way removing a
 * Completed scheduled workout does (that one also deletes a
 * workout_session, which is why it goes through ConfirmModal instead).
 * Ownership is enforced by deleteEventForUser's WHERE clause. Throws if
 * nothing matched, so a forged id can't silently no-op. Revalidates
 * /profile, /, /calendar and /workouts on success.
 */
export async function deleteEvent(id: string) {
  const user = await requireUser();

  const deleted = await deleteEventForUser(id, user.id);

  if (!deleted) {
    throw new Error("Event not found.");
  }

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/workouts");
}

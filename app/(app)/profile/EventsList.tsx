import { X } from "lucide-react";
import {
  daysUntil,
  formatCountdown,
  getPastEventsForUser,
  getUpcomingEventsForUser,
} from "@/lib/events";
import { getUserContext } from "@/lib/user-settings";
import ConfirmModal from "../_components/ConfirmModal";
import EventForm from "./EventForm";
import { EVENT_TYPE_LABELS } from "./event-labels";
import { deleteEvent } from "./events-actions";

const DELETE_ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-danger active:bg-surface-3 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
// Same low-emphasis bordered-button look as the empty-state CTA button
// (EventForm's own ctaLabel) — "Past events" reads as the same kind of
// control as every other quiet button in the app, not a bare native
// <summary> marker, matching GoalsList's "Show N more goals" and
// BodyMetricsList's "All readings". list-none plus the webkit-marker
// override suppress the native disclosure triangle. flex w-full spans the
// full panel width below sm — matching every empty-state CTA in /profile —
// and sm:inline-flex sm:w-auto returns it to sizing on its own text from sm
// up.
const DISCLOSURE_SUMMARY_CLASSES =
  "flex h-10 w-full list-none items-center justify-center rounded-md border border-hairline bg-surface-2 px-4 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus [&::-webkit-details-marker]:hidden sm:inline-flex sm:w-auto";

type EventsListProps = {
  userId: string;
};

/**
 * Its own bordered section (rounded-xl surface-1 panel, matching /stats'
 * panels) — heading, a quiet "Add event" header trigger, and the list
 * itself, all fetched and rendered here rather than page.tsx owning a
 * shared wrapper around this and the other three sections. Upcoming events
 * soonest first, each with its countdown (via daysUntil + formatCountdown),
 * type and location, plus past events collapsed behind a native `<details>`
 * disclosure — same JS-free toggle GoalsList uses for archived goals.
 * `userId` arrives as a prop from ProfilePage rather than a local
 * requireUser() call — same pattern as /stats. The countdown is computed
 * from getUserContext()'s `today` (cached, shared with
 * GoalsList/BodyMetricsList/PersonalRecordsList), not a client-side
 * `new Date()` — see daysUntil in lib/events.ts. Each row's Edit trigger
 * embeds an EventForm instance directly (entry={event}) — same one-modal-
 * per-row wiring as GoalsList, since EventForm already owns its own
 * open/close state and useActionState call. Every delete (the header's own
 * empty-state CTA aside) is confirmed via ConfirmModal, same component the
 * workout builder's own deletes already use.
 *
 * The hero's own EventForm instance (ctaLabel="Add an event") is rendered
 * *unconditionally* — every render, regardless of `isEmpty` — with only its
 * own trigger button hidden (via the `hidden` prop, applied to that one
 * `<button>`, never a wrapping element) once an event exists. See
 * GoalsList's and BodyMetricsList's own doc comments for the full
 * rationale: EventForm owns its own useActionState result and the
 * `successCount` driving its `FormSuccessBanner`, and the save that creates
 * a user's first-ever event is also the save that flips `isEmpty` false in
 * the same transition — an `{isEmpty && <hero/>}` block would unmount that
 * exact instance, discarding the just-set success state, before the
 * browser ever painted the "Saved" banner it had set up to show.
 */
export default async function EventsList({ userId }: EventsListProps) {
  const { today } = await getUserContext(userId);
  const [upcoming, past] = await Promise.all([
    getUpcomingEventsForUser(userId, today),
    getPastEventsForUser(userId, today),
  ]);

  const isEmpty = upcoming.length === 0 && past.length === 0;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink">Events</h2>
        {!isEmpty && <EventForm />}
      </div>

      {isEmpty && (
        <p className="text-sm text-ink-subtle">
          Add a race, competition or test and Home counts down to the
          nearest one.
        </p>
      )}

      {/* Always mounted, regardless of isEmpty — see this file's own doc
          comment for why. `hidden` disables only this button once an event
          exists; FormSuccessBanner (a plain sibling inside EventForm) is
          never affected by it, so the save that creates the first event can
          still show "Saved" even though isEmpty flips false in that same
          render. */}
      <div>
        <EventForm ctaLabel="Add an event" hidden={!isEmpty} />
      </div>

      {!isEmpty && (
        <>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-subtle">No upcoming events.</p>
          ) : (
            <ul className="flex flex-col">
              {upcoming.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 border-b border-surface-3 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-ink">
                      {event.title}
                    </p>
                    <p className="break-words text-xs text-ink-tertiary">
                      {EVENT_TYPE_LABELS[event.eventType].label}
                      {event.location ? ` · ${event.location}` : ""} ·{" "}
                      {event.eventDate}
                    </p>
                    {event.notes && (
                      <p className="break-words text-xs text-ink-tertiary">
                        {event.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {(() => {
                      const days = daysUntil(event.eventDate, today);
                      return days > 1 ? (
                        <div className="text-right">
                          <p className="text-xl font-semibold leading-none text-ink">
                            {days}
                          </p>
                          <p className="mt-1 text-[11px] text-ink-tertiary">
                            days
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-ink">
                          {formatCountdown(days)}
                        </p>
                      );
                    })()}
                    <div className="flex items-center gap-1.5">
                      <EventForm entry={event} />
                      <ConfirmModal
                        trigger={<X className="h-4 w-4" aria-hidden="true" />}
                        triggerClassName={DELETE_ICON_BUTTON_CLASSES}
                        triggerAriaLabel="Delete"
                        title="Delete event"
                        description="This removes the event and its countdown. This can't be undone."
                        confirmLabel="Delete"
                        action={deleteEvent.bind(null, event.id)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <details className="group flex flex-col gap-3 pt-1">
              {/* Same summary-below-content reorder as GoalsList's "Show N
                  more goals" and BodyMetricsList's "All readings" — see
                  either's own comment for why `group`/`order-*`/
                  `group-open:` rather than `open:` or a client toggle. */}
              <summary className={`order-2 ${DISCLOSURE_SUMMARY_CLASSES}`}>
                <span className="group-open:hidden">
                  Past events ({past.length})
                </span>
                <span className="hidden group-open:inline">
                  Hide past events
                </span>
              </summary>
              <ul className="order-1 flex flex-col">
                {past.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-3 border-b border-surface-3 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm text-ink-muted">
                        {event.title}
                      </p>
                      <p className="break-words text-xs text-ink-tertiary">
                        {EVENT_TYPE_LABELS[event.eventType].label}
                        {event.location ? ` · ${event.location}` : ""} ·{" "}
                        {event.eventDate}
                      </p>
                      {event.notes && (
                        <p className="break-words text-xs text-ink-tertiary">
                          {event.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <EventForm entry={event} />
                      <ConfirmModal
                        trigger={<X className="h-4 w-4" aria-hidden="true" />}
                        triggerClassName={DELETE_ICON_BUTTON_CLASSES}
                        triggerAriaLabel="Delete"
                        title="Delete event"
                        description="This removes the event and its countdown. This can't be undone."
                        confirmLabel="Delete"
                        action={deleteEvent.bind(null, event.id)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

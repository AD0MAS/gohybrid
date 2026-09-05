"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

const BANNER_CLASSES =
  "fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-md border px-4 py-2 text-sm";

/**
 * Fixed-bottom "Saving…" banner for the pending half of a form submission —
 * not a modal, no backdrop, nothing that blocks interaction. Must be
 * rendered as a JSX child inside the <form> it reports on: useFormStatus
 * only sees the nearest enclosing <form>, so it can't be called from the
 * same component that renders the <form> tag itself, only from a component
 * nested below it. Purely a visual cue — SubmitButton (below) is what
 * actually stops a double click from firing the action twice.
 */
export function FormPendingBanner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <p role="status" className={`${BANNER_CLASSES} border-hairline-strong bg-surface-2 text-ink`}>
      {label}
    </p>
  );
}

/**
 * A `type="submit"` button that disables itself while its enclosing <form>
 * is submitting (via useFormStatus), so a slow connection can't let a
 * double click fire the action twice. Drop-in replacement for the
 * `<button type="submit">…</button>` every form here wrote by hand — same
 * required `className` prop, so swapping it in changes no styling.
 */
export function SubmitButton({
  children,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  className: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

/**
 * Prop-driven counterpart to FormPendingBanner, for a <form> that isn't a
 * React 19 Action (i.e. uses onSubmit instead of action) — useFormStatus
 * only reports pending state for a <form action={...}>, so a form driven by
 * a plain client function has no hook to read and passes its own pending
 * state in instead. A separate component rather than an optional prop on
 * FormPendingBanner itself, so every existing action-based call site is
 * untouched by this addition.
 */
export function PendingBanner({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  if (!pending) return null;

  return (
    <p role="status" className={`${BANNER_CLASSES} border-hairline-strong bg-surface-2 text-ink`}>
      {label}
    </p>
  );
}

/**
 * Prop-driven counterpart to SubmitButton, for the same non-Action <form>
 * case as PendingBanner above — disables itself from the caller's own
 * pending state instead of useFormStatus.
 */
export function PendingSubmitButton({
  pending,
  children,
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  className: string;
}) {
  return (
    <button type="submit" disabled={pending} className={className}>
      {children}
    </button>
  );
}

/**
 * Brief "Saved" confirmation for the success half of a form submission —
 * the same fixed-bottom position as FormPendingBanner, so it reads as that
 * banner turning into a confirmation, then disappears on its own after two
 * seconds.
 *
 * Deliberately NOT rendered inside the <form>, and — for a modal form —
 * NOT inside the <Modal> either: it must be owned by the component that
 * holds the action's useActionState result instead. A successful submit
 * closes the modal in the same render (see BodyMetricFields/GoalFields/
 * PersonalRecordFields/EventForm/ScheduleWorkoutForm), and Modal wraps a
 * native <dialog> — closing it stops the UA from rendering anything inside,
 * pending banner included, regardless of `position: fixed`. A banner
 * mounted inside the form would vanish with the dialog before anyone saw
 * it; mounted by the parent instead, it survives the close.
 *
 * `trigger` is a value the parent changes each time its action state
 * transitions to success — every caller already has an identity check
 * (`state !== prevState`) that closes the modal on success, so bumping a
 * counter there is the natural place to drive this too.
 *
 * Detecting that change happens during render — `trigger !== prevTrigger`,
 * mirroring the *Fields components' own `state !== prevState` check —
 * rather than in a useEffect keyed on `[trigger]` with a "have I run
 * before" ref, which is what this used to do and is what made "Saved"
 * flash on every mount with no submission ever made: React (Strict Mode in
 * dev, and concurrent rendering generally) can run an effect's setup
 * twice on mount without resetting a plain ref in between, so the ref set
 * by the first, throwaway run was already `true` by the time the second,
 * real run read it — the "first run" it was meant to skip had already
 * happened, from its own point of view, on the previous invocation.
 * `prevTrigger` sidesteps this rather than working around it: it's a state
 * variable initialized to `trigger`'s own first value, so the two start
 * out equal by construction and the comparison only ever fires on a render
 * that genuinely sees a different `trigger` — safe under any number of
 * render replays, because it never relies on "was this the first time."
 *
 * The auto-hide timer stays in a useEffect — scheduling a callback is a
 * real side effect, unlike the comparison above — but keyed on
 * `[visible, trigger]` rather than `[visible]` alone: two successes close
 * together bump `trigger` again while `visible` is already `true` (so
 * `visible` itself doesn't change), and the second success should still
 * restart the two-second countdown rather than let the first one's timer
 * cut the banner short.
 */
export function FormSuccessBanner({
  trigger,
  label,
}: {
  trigger: number;
  label: string;
}) {
  const [prevTrigger, setPrevTrigger] = useState(trigger);
  const [visible, setVisible] = useState(false);

  if (trigger !== prevTrigger) {
    setPrevTrigger(trigger);
    setVisible(true);
  }

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timeout);
  }, [visible, trigger]);

  if (!visible) return null;

  return (
    <p role="status" className={`${BANNER_CLASSES} border-success/40 bg-surface-2 text-success`}>
      {label}
    </p>
  );
}

/**
 * Success confirmation for an action that redirects on success instead of
 * staying mounted (saveSettings → /profile, createFullWorkout/
 * updateFullWorkout → /workouts/[id]) — the case FormSuccessBanner above
 * can't cover, since its whole API is "notice `trigger` changed," and a
 * redirect target mounts fresh exactly once with the query param already
 * set. There's nothing to detect a change from, so instead of retrofitting
 * FormSuccessBanner (and risking its existing callers, which stay on the
 * trigger-based model), this is a separate component with the identical
 * markup/classes so the two are visually indistinguishable.
 *
 * The destination page (a Server Component) reads its own searchParams,
 * decides whether the value it got back is the one it's looking for, and
 * passes only a plain `show` boolean in — this component never calls
 * useSearchParams itself, which keeps it a true leaf (no Suspense boundary
 * needed) and keeps "what counts as a valid param value" a decision the
 * page makes, not something guessed from inside a shared component.
 *
 * `useState(show)` — not `useState(false)` — so the banner is already
 * visible on the very first paint instead of flashing in a frame late.
 * `show` itself never changes after mount (the page it's rendered on
 * doesn't re-run this component's props reactively — a fresh navigation
 * mounts a fresh instance), so unlike FormSuccessBanner there's no
 * "retrigger on a later change" case to support.
 *
 * The query param is stripped via a raw `history.replaceState` call, not
 * `router.replace()`: the App Router treats a changed search string as a
 * new dynamic request and refetches the route's RSC payload, which would
 * mean a second server round trip purely to make the address bar match
 * what's already on screen. `replaceState` edits the address bar only, with
 * no navigation, no fetch, and — because it replaces rather than pushes —
 * no new history entry for the back button to land on. It runs inside the
 * same mount effect that starts the 2-second auto-hide timer, so a reload
 * a moment later (before the timer even fires) already sees a clean URL.
 */
export function RedirectSuccessBanner({
  show,
  label,
  paramName,
}: {
  show: boolean;
  label: string;
  paramName: string;
}) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;

    const url = new URL(window.location.href);
    url.searchParams.delete(paramName);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    const timeout = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timeout);
  }, [show, paramName]);

  if (!visible) return null;

  return (
    <p role="status" className={`${BANNER_CLASSES} border-success/40 bg-surface-2 text-success`}>
      {label}
    </p>
  );
}

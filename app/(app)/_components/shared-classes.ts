// Class strings duplicated verbatim across three or more files, pulled out
// so each pattern is defined once. Grouped here rather than in
// section-button.ts (a different, single-purpose pair) since these span
// unrelated call sites with nothing else in common but their markup. Each
// export changes no visual output from the strings it replaces — copy the
// exact class list, don't paraphrase it, if a call site needs to diverge.

/** A page's top-level `<main>` — the width cap, gutters and vertical rhythm
 * every (app) page opens with (Home is the one exception, at gap-6 with no
 * lg:px-8 changes — it already matched otherwise, so it still composes this
 * directly). */
export const PAGE_MAIN_CLASSES =
  "mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8";

/** A bordered surface-1 section: /profile's four lists, the week strip,
 * the month calendar, /settings' two sections — a heading, content, then
 * (in /profile) a footer button, all at gap-4. */
export const PANEL_CLASSES =
  "flex flex-col gap-4 rounded-panel border border-hairline bg-surface-1 p-5";

/** The same bordered surface-1 section at gap-3 instead of gap-4 — Home's
 * Quick actions/Recent activity, /history's Recent history, /stats' four
 * chart panels, /workouts' filter panel, and the workout page's Sessions
 * panel: a heading and its own content with less air between them than a
 * /profile list needs for its footer button. */
export const PANEL_CLASSES_COMPACT =
  "flex flex-col gap-3 rounded-panel border border-hairline bg-surface-1 p-5";

/** A text `<input>`/`<select>` on a surface-2 panel (the /profile forms'
 * own modals, each opened from a surface-1 list) — h-11, surface-2, the
 * standard focus ring. */
export const FIELD_CLASSES_SURFACE_2 =
  "h-11 rounded-control border border-hairline bg-surface-2 px-4 text-base text-ink placeholder:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** The same field, on a surface-1 panel instead (the builder's modals,
 * already surface-1 inside a surface-2 dialog body, and LogPastSessionForm/
 * ScheduleWorkoutForm's own surface-1 modals). No `placeholder:` styling —
 * none of these fields use one. */
export const FIELD_CLASSES_SURFACE_1 =
  "h-11 rounded-control border border-hairline bg-surface-1 px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** The app's one filled/accent button look, content-sized (`h-11 px-5`) —
 * a modal's Save/Add, the auth pages' submit, ConfirmModal's primary
 * variant. The full-width variants (`w-full`, `w-full self-start`) are
 * their own constants below, since `w-full` isn't just an addition to this
 * string — some callers need exactly this, unprefixed, on a `<button
 * form={...}>` outside a `<form>`. */
export const SUBMIT_BUTTON_CLASSES =
  "flex h-11 items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** SUBMIT_BUTTON_CLASSES at full width below `sm`, sized to its own text
 * from `sm` up (GoalFields' inline Add goal, /settings' Save, /workouts'
 * "New workout" and empty-state "Create your first workout"). */
export const SUBMIT_BUTTON_CLASSES_FULL =
  `flex h-11 w-full items-center justify-center rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto`;

/** SUBMIT_BUTTON_CLASSES_FULL plus `self-start`, for a button sitting in a
 * flex column that would otherwise stretch it to the column's own width
 * (Home's and /workouts' empty-state hero CTAs). */
export const SUBMIT_BUTTON_CLASSES_FULL_SELF_START =
  `flex h-11 w-full items-center justify-center self-start rounded-control bg-accent px-5 text-base text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus sm:w-auto`;

/** The app's one bordered/secondary button look, on a surface-1 background
 * (Edit, Settings, Cancel in a surface-1 modal footer). */
export const SECONDARY_BUTTON_CLASSES_SURFACE_1 =
  "flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-1 px-5 text-base text-ink hover:bg-surface-2 active:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** The same secondary button, one surface up (Cancel inside the /profile
 * forms' own surface-2 modals, which sit on a surface-1 dialog body). */
export const SECONDARY_BUTTON_CLASSES_SURFACE_2 =
  "flex h-11 items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-base text-ink hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** A 32px icon-only button on a surface-2 panel — Edit/Configure/Duplicate
 * triggers across /profile and CardMenu's own launcher. */
export const ICON_BUTTON_CLASSES_32 =
  "flex h-8 w-8 items-center justify-center rounded-small border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** The same 32px icon button in the app's destructive-hover look (danger
 * only on hover/active, never at rest — see GoalsList's own comment on
 * that convention) — every /profile list's own delete trigger. */
export const DANGER_ICON_BUTTON_CLASSES_32 =
  "flex h-8 w-8 items-center justify-center rounded-small border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-danger active:bg-surface-3 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/** A native `<details>` disclosure's `<summary>`, styled as an ordinary
 * quiet button rather than the browser's own triangle marker — "Past
 * events", "Show N more goals", "All readings". `list-none` plus the
 * `[&::-webkit-details-marker]:hidden` override suppress that marker;
 * `sm:inline-flex sm:w-auto` returns it to sizing on its own text from `sm`
 * up after spanning full width below it, matching every empty-state CTA in
 * /profile. */
export const DISCLOSURE_SUMMARY_CLASSES =
  "flex h-10 w-full list-none items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus [&::-webkit-details-marker]:hidden sm:inline-flex sm:w-auto";

/** A page's small-caps section eyebrow above its own heading — Home's and
 * /workouts' "Start here"/empty-state kicker text. */
export const EYEBROW_CLASSES =
  "text-xs font-medium uppercase tracking-widest text-accent-ink-subtle";

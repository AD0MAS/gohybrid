import { Archive, ArchiveRestore, X } from "lucide-react";
import { SubmitButton } from "@/app/_components/FormStatus";
import { getExerciseCatalog } from "@/lib/exercises";
import { computeGoalProgress, getGoalsForUser, resolveGoalCurrentValues } from "@/lib/goals";
import { getDistinctCustomNamesForUser } from "@/lib/personal-records";
import { getUserContext } from "@/lib/user-settings";
import ConfirmModal from "../_components/ConfirmModal";
import GoalCardMenu, { MENU_ITEM_CLASSES, MENU_ITEM_DANGER_CLASSES } from "./GoalCardMenu";
import GoalFields from "./GoalFields";
import { formatGoalValueText, getGoalSubjectLabel, GOAL_PERIOD_LABELS, GOAL_TYPE_LABELS } from "./goal-labels";
import { deleteGoal, setGoalArchived } from "./goals-actions";

const ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
const DELETE_ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-danger active:bg-surface-3 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
// Same low-emphasis bordered-button look as the empty-state CTAs
// (EventForm/BodyMetricFields/PersonalRecordFields' own ctaLabel button) —
// shared by both of this file's disclosures ("Show N more goals" and
// "Archived goals") so every disclosure summary in /profile reads as the
// same kind of control, not a bare native <summary> marker. list-none plus
// the webkit-marker override suppress the native disclosure triangle,
// which would otherwise sit oddly next to a bordered button background.
// flex w-full spans the full panel width below sm — matching every
// empty-state CTA in /profile — and sm:inline-flex sm:w-auto returns it to
// sizing on its own text from sm up, same as before.
const DISCLOSURE_SUMMARY_CLASSES =
  "flex h-10 w-full list-none items-center justify-center rounded-md border border-hairline bg-surface-2 px-4 text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus [&::-webkit-details-marker]:hidden sm:inline-flex sm:w-auto";

type GoalsListProps = {
  userId: string;
};

/**
 * Its own bordered section (rounded-xl surface-1 panel, matching /stats'
 * panels), except for its own Add trigger: Goals is the one section whose
 * Add action is promoted to page.tsx's own header as the single accent
 * call-to-action, so page.tsx still renders GoalForm there instead of this
 * component owning it — see page.tsx's doc comment. Active goals render as
 * a two-column grid of cards, each with a resolved current value and
 * progress bar; archived goals collapse behind a native `<details>`
 * disclosure — no client JavaScript needed for that toggle. Archived goals
 * skip the current-value resolution (and so show no progress bar): they're
 * hidden by default and their progress isn't the point once archived. A
 * body_metric/personal_record goal whose source has no rows yet resolves to
 * `null` (see resolveGoalCurrentValues) rather than a fabricated 0 — this
 * renders as a "no data yet" line with no progress bar, instead of the
 * misleading 100% a decrease goal's (start - 0) / (start - target) would
 * otherwise compute. Both "today" and the source queries' timezone come
 * from getUserContext (cached, so this and EventsList/BodyMetricsList/
 * PersonalRecordsList share one pair of queries per request). `userId`
 * arrives as a prop from ProfilePage rather than a local requireUser() call
 * — same pattern as /stats. Each active card's Edit/Archive/Delete live
 * behind a GoalCardMenu (a small client component, three plain icon
 * buttons don't fit once a card is half the panel's width) rather than as
 * separate buttons — GoalFields still owns Edit's own open/close state and
 * useActionState call, rendering its trigger as a plain menu-item button
 * via `triggerVariant="menu-item"` (a serializable string, not a callback:
 * this list is a Server Component, and a function prop can't cross into
 * GoalFields' Client Component boundary — see that prop's own doc comment).
 * One instance per row still needs no coordination between rows and this
 * list stays a plain Server Component; only the menu's open/closed state is
 * client-side.
 * `catalog` is fetched here (not just in GoalForm) so every row's embedded
 * GoalFields has what it needs for personal_record goals, same as
 * GoalForm's own fetch — and, for the hero empty state's own CTA (see
 * below), so it has it too. Every delete (that CTA aside) is confirmed via
 * ConfirmModal, same component the workout builder's own deletes use.
 * Archived rows keep their original two-icon-button layout (Unarchive,
 * Delete) rather than the same menu — two buttons on a full-width row never
 * had the crowding problem the active cards did.
 *
 * page.tsx's header shows its own Add-goal button for every state that has
 * ever had a goal — active, all archived, or a mix — and hides it only when
 * `allGoals.length === 0` (getTotalGoalCountForUser). This section's own
 * hero CTA below covers exactly that one remaining case; the all-archived
 * state used to carry a second, in-section copy of this same button (worded
 * for that state), which put a button beside every OTHER state's own quiet
 * explanatory text instead of matching them — it's gone now, replaced by
 * the same kind of plain sentence the "no data yet"/empty states elsewhere
 * on this page already use, since the header covers Add for that state too.
 *
 * The hero's own GoalFields instance is rendered *unconditionally* — every
 * render, regardless of `isEmpty` — and only its own trigger button is
 * hidden (via the `hidden` prop, applied to that one `<button>` itself, not
 * to any wrapping element) once a goal exists. This looks backwards next to
 * the rest of this file's `{condition && <JSX/>}` conventions, but it fixes
 * a real bug: GoalFields owns its own useActionState result and a
 * `successCount` that drives its `FormSuccessBanner` (see GoalFields' own
 * doc comment) — state that lives entirely in *this* component instance.
 * The save that creates a user's first-ever goal is also the save that
 * flips `isEmpty` from true to false, in the same transition (the Server
 * Action's revalidatePath("/profile") and the client's own success state
 * update land together). If that GoalFields instance is only ever rendered
 * inside an `{isEmpty && <hero/>}` block, then the instant it turns
 * `isEmpty` false, this section's whole hero subtree — including the exact
 * GoalFields instance that just bumped its own successCount — gets
 * unmounted by that same render, before the browser ever paints the
 * "Saved" banner it had just set up to show. This is the same class of bug
 * GoalCardMenu's own doc comment describes for Edit/Archive/Delete failing
 * silently: something set its own state, then got torn down in the same
 * tick before that state took visible effect. The fix is the same one
 * GoalCardMenu already uses — keep the stateful instance mounted always,
 * and toggle only its visual presentation (here, a `hidden` prop that
 * disables just the trigger `<button>`, leaving `FormSuccessBanner` — a
 * plain sibling inside GoalFields, not a descendant of anything conditional
 * — completely unaffected by whatever `isEmpty` becomes the moment the
 * hero's own save succeeds).
 */
export default async function GoalsList({ userId }: GoalsListProps) {
  const [allGoals, catalog, customNames, { today, timezone, unitSystem }] =
    await Promise.all([
      getGoalsForUser(userId, true),
      getExerciseCatalog(),
      getDistinctCustomNamesForUser(userId),
      getUserContext(userId),
    ]);

  const isEmpty = allGoals.length === 0;
  const activeGoals = allGoals.filter((g) => !g.isArchived);
  const archivedGoals = allGoals.filter((g) => g.isArchived);

  // Skip resolving current values entirely when there's nothing to show —
  // resolveGoalCurrentValues issues real per-subject queries, and an empty
  // activeGoals array has none to make.
  const currentValues = isEmpty
    ? new Map<string, number | null>()
    : await resolveGoalCurrentValues(activeGoals, userId, today, timezone);

  const activeWithProgress = activeGoals.map((goal) => {
    const current = currentValues.get(goal.id) ?? null;
    return {
      goal,
      progress: current === null ? null : computeGoalProgress(goal, current),
    };
  });

  // Mobile caps the grid at 4 cards, with the rest behind a "Show N more"
  // disclosure — a long goal list otherwise pushes Events/Body metrics/
  // Personal records (further down the single mobile column) an
  // unpredictable distance down the page. Desktop shows every goal at once,
  // uncapped: see visibleGoals/extraGoals' rendering below for how that
  // split is undone above the sm breakpoint without JavaScript.
  const VISIBLE_GOAL_LIMIT = 4;
  const visibleGoals = activeWithProgress.slice(0, VISIBLE_GOAL_LIMIT);
  const extraGoals = activeWithProgress.slice(VISIBLE_GOAL_LIMIT);

  function renderGoalCard({
    goal,
    progress,
  }: (typeof activeWithProgress)[number]) {
    const subject = getGoalSubjectLabel(goal);

    return (
      <div
        key={goal.id}
        className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-2 p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            {/* A flex item's own min-width defaults to "auto" — the width
                of its longest unbreakable run of characters, not 0 — so
                without its own min-w-0 this paragraph could refuse to
                shrink below an unbroken title's full width regardless of
                the column around it. break-words (overflow-wrap:
                break-word) is what actually performs the visual break once
                the box is narrow enough to need one, but per spec it does
                not itself reduce the element's own min-content size the
                way overflow-wrap: anywhere would — the two are
                complementary, not alternatives: min-w-0 is what lets the
                box shrink at all, break-words is what it does with the
                extra room once it has to. No line-clamp here: a goal title
                now wraps to as many lines as it needs, since min-w-0 (here,
                on this card's own flex-col wrapper above, and on page.tsx's
                two column wrappers) already keeps an unbroken title from
                stretching anything around it — the two-line cap was
                covering for a layout risk that no longer exists, at the
                cost of hiding real title text behind an ellipsis. */}
            <p className="min-w-0 break-words text-sm font-medium text-ink">{goal.title}</p>
            {/* `subject` (getGoalSubjectLabel) can be a user-entered custom
                exercise/record name for a personal_record goal, not just a
                fixed catalog or metric-type label — the same unbroken-string
                risk as the title above. */}
            <p className="break-words text-xs text-ink-tertiary">
              {GOAL_TYPE_LABELS[goal.goalType].label}
              {subject ? ` · ${subject}` : ""} ·{" "}
              {GOAL_PERIOD_LABELS[goal.period].label}
            </p>
          </div>
          <GoalCardMenu>
            <GoalFields
              catalog={catalog}
              customNames={customNames}
              unitSystem={unitSystem}
              entry={goal}
              triggerVariant="menu-item"
            />
            <form action={setGoalArchived.bind(null, goal.id, true)}>
              <SubmitButton className={MENU_ITEM_CLASSES}>
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </SubmitButton>
            </form>
            <ConfirmModal
              trigger={
                <>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Delete
                </>
              }
              triggerClassName={MENU_ITEM_DANGER_CLASSES}
              title="Delete goal"
              description="This removes the goal and its progress. This can't be undone."
              confirmLabel="Delete"
              action={deleteGoal.bind(null, goal.id)}
            />
          </GoalCardMenu>
        </div>

        {progress === null ? (
          <p className="text-sm text-ink-subtle">
            No data yet for this goal.
          </p>
        ) : (
          (() => {
            // Completion is decided from the raw `percent`, never from
            // `roundedPercent` — that's the exact bug this once had: a goal
            // at 9997.9 / 9999.9 has a real percent of 99.979..., and
            // keying "complete" off the rounded display number turned that
            // into a false 100%, both in the text and in this bar's own
            // fill colour. `roundedPercent` (computeGoalProgress, already
            // clamped so it can't claim 100 or 0 the raw percent hasn't
            // reached) is used purely for what's printed on screen.
            const isComplete = progress.percent >= 100;

            return (
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-accent"}`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="flex items-baseline justify-between gap-2 text-xs text-ink-tertiary">
                  <span>
                    {formatGoalValueText(goal, progress.current, unitSystem)} /{" "}
                    {formatGoalValueText(goal, progress.target, unitSystem)}
                  </span>
                  <span className={isComplete ? "text-success" : "text-ink-tertiary"}>
                    {progress.roundedPercent}%
                  </span>
                </p>
              </div>
            );
          })()
        )}
      </div>
    );
  }

  return (
    <section
      className={
        isEmpty
          ? "flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-6 sm:p-7"
          : "flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5"
      }
    >
      {isEmpty ? (
        <>
          <p className="text-xs font-medium uppercase tracking-widest text-accent-ink-subtle">
            Your targets
          </p>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Start with one goal
            </h2>
            <p className="max-w-xl text-sm text-ink-subtle">
              A goal turns sessions into progress — a session count, a
              distance, a lift, a streak. Home shows the one closest to done;
              this page holds the rest.
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink">Goals</h2>
          <span className="text-xs text-ink-tertiary">
            {activeGoals.length} active
          </span>
        </div>
      )}

      {/* Always mounted, regardless of isEmpty — see this file's own doc
          comment for why. `hidden` disables only this button once a goal
          exists; FormSuccessBanner (a plain sibling inside GoalFields) is
          never affected by it, so the save that creates the first goal can
          still show "Saved" even though isEmpty flips false in that same
          render. */}
      <div>
        <GoalFields
          catalog={catalog}
          customNames={customNames}
          unitSystem={unitSystem}
          addLabel="Set your first goal"
          hidden={!isEmpty}
        />
      </div>

      {!isEmpty && (
        <>
          {activeGoals.length === 0 ? (
            <p className="text-sm text-ink-subtle">
              Every goal is archived right now. Add one from the header
              above, or unarchive one below.
            </p>
          ) : (
            // gap-3 here — not the section's own gap-4 — is what makes an
            // expanded "Show N more goals" indistinguishable from a list
            // that was never collapsed: the visible grid and the revealed
            // extras used to be two direct children of the *section's* flex
            // column, so the section's own between-blocks gap-4 (plus the
            // details' own pt-1) landed between the 4th card and the 5th,
            // wider than the gap-3 every other pair of cards uses. Grouping
            // them under one gap-3 wrapper instead means that boundary gets
            // the same gap as any other, on both the mobile disclosure and
            // the always-visible desktop grid below it.
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleGoals.map(renderGoalCard)}
              </div>

              {extraGoals.length > 0 && (
                <>
                  {/* Below sm: a native disclosure, closed by default — no
                      unconditional display utility on its content div, since one
                      would be an author-origin rule and author-normal always beats
                      the UA's own `details:not([open]) > :not(summary) { display:
                      none }` regardless of specificity (the exact mechanism that
                      broke Modal.tsx once already — see its own doc comment — used
                      correctly here instead of fought). `space-y-3` only ever sets
                      margin-top on children via a sibling selector, never
                      `display`, so it's the one utility here that's safe to leave
                      unconditional; the div's own display is left entirely to the
                      native open/closed toggle.
                      `group flex flex-col` plus `order-2` on the summary and
                      `order-1` on the content div puts the revealed cards above
                      the button instead of below it — a native <details> always
                      renders <summary> first in DOM order, so this is a pure CSS
                      reorder, not a different disclosure mechanism; `gap-3` on
                      the <details> itself (rather than a margin on one specific
                      child) supplies the space between whichever two elements
                      end up adjacent in *visual* order. The two <span>s inside
                      the summary swap via `group-open:` (Tailwind's variant for a
                      `group`-marked ancestor's own `[open]` state reaching a
                      descendant) rather than the plain `open:` variant, which
                      only ever targets the element that carries the `[open]`
                      attribute itself — the spans are descendants of it, not
                      that element, so only the group-scoped variant can reach
                      them. No client state anywhere in this.
                      From sm up: a completely separate, always-rendered,
                      unconditional grid, not a responsive override of the
                      disclosure's content — the disclosure and its summary are
                      `sm:hidden` in their own right at that point, so there's no
                      closed-by-default state left to fight in the first place. */}
                  <details className="group flex flex-col gap-3 sm:hidden">
                    <summary className={`order-2 ${DISCLOSURE_SUMMARY_CLASSES}`}>
                      <span className="group-open:hidden">
                        Show {extraGoals.length} more goal{extraGoals.length === 1 ? "" : "s"}
                      </span>
                      <span className="hidden group-open:inline">Show less</span>
                    </summary>
                    <div className="order-1 space-y-3">{extraGoals.map(renderGoalCard)}</div>
                  </details>
                  <div className="hidden grid-cols-2 gap-3 sm:grid">
                    {extraGoals.map(renderGoalCard)}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {archivedGoals.length > 0 && (
        // Same summary-below-content reorder as "Show N more goals" above
        // — see that disclosure's own comment for why `group`/`order-*`/
        // `group-open:` rather than `open:` or a client toggle. Four
        // disclosures in /profile, one behaviour: full width below sm,
        // content-sized from sm up, revealed content above the button.
        <details className="group flex flex-col gap-3 pt-1">
          <summary className={`order-2 ${DISCLOSURE_SUMMARY_CLASSES}`}>
            <span className="group-open:hidden">
              Archived goals ({archivedGoals.length})
            </span>
            <span className="hidden group-open:inline">
              Hide archived goals
            </span>
          </summary>
          <div className="order-1 flex flex-col">
            {archivedGoals.map((goal) => {
              const targetText = formatGoalValueText(goal, goal.targetValue, unitSystem);
              const subject = getGoalSubjectLabel(goal);

              return (
                <div
                  key={goal.id}
                  className="flex items-center justify-between gap-2 border-b border-surface-3 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm text-ink-muted">{goal.title}</p>
                    {/* Same user-entered-custom-name risk as the active
                        card's own meta line above. */}
                    <p className="break-words text-xs text-ink-tertiary">
                      {GOAL_TYPE_LABELS[goal.goalType].label}
                      {subject ? ` · ${subject}` : ""} · Target {targetText}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <form action={setGoalArchived.bind(null, goal.id, false)}>
                      <SubmitButton ariaLabel="Unarchive" className={ICON_BUTTON_CLASSES}>
                        <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                      </SubmitButton>
                    </form>
                    <ConfirmModal
                      trigger={<X className="h-4 w-4" aria-hidden="true" />}
                      triggerClassName={DELETE_ICON_BUTTON_CLASSES}
                      triggerAriaLabel="Delete"
                      title="Delete goal"
                      description="This removes the goal and its progress. This can't be undone."
                      confirmLabel="Delete"
                      action={deleteGoal.bind(null, goal.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}

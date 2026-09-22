import { X } from "lucide-react";
import { BODY_METRIC_TYPES } from "@/db/enums";
import { computeBodyMetricTrend, getBodyMetricsForUser } from "@/lib/body-metrics";
import { formatBodyMetricValue } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import ConfirmModal from "../_components/ConfirmModal";
import CardMenu, { MENU_ITEM_DANGER_CLASSES } from "../_components/CardMenu";
import BodyMetricFields from "./BodyMetricFields";
import BodyMetricTypeTabs from "./BodyMetricTypeTabs";
import { deleteBodyMetric } from "./body-metrics-actions";
import { BODY_METRIC_LABELS } from "./body-metric-labels";
import { DANGER_ICON_BUTTON_CLASSES_32, DISCLOSURE_SUMMARY_CLASSES, PANEL_CLASSES } from "../_components/shared-classes";

type BodyMetricsListProps = {
  userId: string;
};

/** Presentational only — picks whether a reading gap reads more naturally
 * in days or weeks, the same "pick the more natural unit past a threshold"
 * idiom formatDistanceMetres/formatDurationSeconds already use elsewhere in
 * this app. Not part of computeBodyMetricTrend (lib/body-metrics.ts), which
 * returns the raw day count — this is display text, not a metric. */
function formatDayGap(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

/**
 * Its own bordered section (rounded-panel surface-1 panel, matching /stats'
 * panels), fetching its own data the same way EventsList/GoalsList/
 * PersonalRecordsList do rather than page.tsx owning a shared wrapper.
 * Above the readings: one tile per tracked metric type with its latest
 * value and the trend since the previous reading (computeBodyMetricTrend,
 * lib/body-metrics.ts — latest vs. the one immediately before it, no fixed
 * window). Below: every tracked type's full reading list is rendered here,
 * server-side, but only one is visible at a time — BodyMetricTypeTabs (a
 * small client component) just toggles which wrapper loses `hidden`, so no
 * metric data or query ever needs to move to the browser (see its own doc
 * comment). On mobile, the tabs (and everything inside them) sit behind one
 * more disclosure — "All readings", collapsed by default — while desktop
 * shows them directly; both are the same `tabs` array handed to two
 * separate `BodyMetricTypeTabs` mounts (`sm:hidden` one, `hidden sm:block`
 * the other) rather than one mount whose wrapper's visibility is overridden
 * per breakpoint, so there's no fight with the native disclosure's own
 * closed-state hiding to reason through. `userId` arrives as a prop from
 * ProfilePage rather than a local requireUser() call — same pattern as
 * /stats. getBodyMetricsForUser
 * already returns rows newest-measured-first, so grouping here doesn't need
 * to re-sort. Each entry's value is converted for display via
 * formatBodyMetricValue and the viewing user's unitSystem (getUserContext)
 * — the stored value stays kg/%/bpm regardless. Each row's Edit trigger
 * embeds a BodyMetricFields instance directly (entry={entry}) — same
 * one-modal-per-row wiring as GoalsList/EventsList, since BodyMetricFields
 * already owns its own open/close state and useActionState call. Every
 * delete is confirmed via ConfirmModal. Edit and Delete collapse into one
 * CardMenu below `sm` (BodyMetricFields' `triggerVariant="menu-item"`, same
 * pattern as GoalsList's card menu) and stay separate icon buttons from
 * `sm` up, exactly as before.
 *
 * The one "Add measurement" BodyMetricFields is rendered *unconditionally*,
 * in the same spot after the readings, whether or not `isEmpty` — never
 * inside an `{isEmpty && …}` or `{!isEmpty && …}` block. It owns its own
 * useActionState result and the `successCount` driving its
 * `FormSuccessBanner` (see BodyMetricFields' own doc comment), and the save
 * that records a user's first-ever measurement is also the save that flips
 * `isEmpty` from true to false in the same transition (the Server Action's
 * revalidatePath("/profile") and the client's own success state update land
 * together). A conditional would unmount that exact instance in that same
 * render, discarding the just-set success state before the browser ever
 * painted the "Saved" banner. Same bug class as CardMenu's own doc comment
 * describes: something set its own state, then got torn down in the same
 * tick.
 */
export default async function BodyMetricsList({ userId }: BodyMetricsListProps) {
  const [metrics, { today, unitSystem }] = await Promise.all([
    getBodyMetricsForUser(userId),
    getUserContext(userId),
  ]);

  const isEmpty = metrics.length === 0;

  const groups = BODY_METRIC_TYPES
    .map((type) => ({ type, entries: metrics.filter((m) => m.metricType === type) }))
    .filter((group) => group.entries.length > 0);

  return (
    <section
      id="metrics"
      className={PANEL_CLASSES}
    >
      <h2 className="text-section font-semibold text-ink">Body metrics</h2>

      {isEmpty && (
        <p className="text-sm text-ink-subtle">
          Log weight, body fat or resting HR. Two readings and Stats can
          draw the trend.
        </p>
      )}

      {!isEmpty && (
        <>
          {/* Always three equal columns, at every width down to the
              narrowest phone — a metric card dropping to its own row (or
              being forced into a 2-column layout on the panel's narrow
              lg-and-up slice) was tried and rejected. What gives instead is
              the card's own height, not its content: the trend line (the
              longest of the three, e.g. "-0.3 kg in 6 days") wraps to two
              lines on a narrow phone rather than being forced onto one and
              shrunk to fit — matching the mockup, which lets exactly this
              line wrap — and none of the three lines truncates. A clipped
              number with no visible indication it was clipped is worse than
              a taller card; min-w-0 on the card (a grid item's own
              min-width is "auto" by default, same as a flex item's) is what
              lets the text wrap inside the column's actual width instead of
              overflowing it in the first place. */}
          <div className="grid grid-cols-3 gap-1.5">
            {groups.map(({ type, entries }) => {
              const latest = entries[0];
              const display = formatBodyMetricValue(type, latest.value, unitSystem);
              const trend = computeBodyMetricTrend(entries);
              const trendDisplay = trend
                ? formatBodyMetricValue(type, trend.deltaValue, unitSystem)
                : null;

              return (
                <div
                  key={type}
                  className="flex min-w-0 flex-col gap-0.5 rounded-card border border-hairline bg-surface-2 p-2"
                >
                  <p className="text-base font-semibold tracking-tight text-ink">
                    {display.value} {display.unit}
                  </p>
                  <p className="text-[10px] text-ink-subtle">
                    {BODY_METRIC_LABELS[type].label}
                  </p>
                  {trendDisplay && trend && (
                    <p className="text-[11px] leading-tight text-ink-tertiary">
                      {trendDisplay.value > 0 ? "+" : ""}
                      {trendDisplay.value} {trendDisplay.unit} in{" "}
                      {formatDayGap(trend.daysBetween)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {(() => {
            const tabs = groups.map(({ type, entries }) => ({
              key: type,
              label: BODY_METRIC_LABELS[type].label,
              content: (
                <ul className="flex flex-col">
                  {entries.map((entry) => {
                    const display = formatBodyMetricValue(
                      type,
                      entry.value,
                      unitSystem
                    );
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-3 border-b border-surface-3 py-3 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {display.value} {display.unit}
                          </p>
                          <p className="text-xs text-ink-tertiary">
                            {entry.measuredAt}
                          </p>
                          {entry.notes && (
                            <p className="break-words text-xs text-ink-tertiary">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                          <BodyMetricFields
                            today={today}
                            unitSystem={unitSystem}
                            entry={entry}
                            returnTo="/profile#metrics"
                          />
                          <ConfirmModal
                            trigger={<X className="h-4 w-4" aria-hidden="true" />}
                            triggerClassName={DANGER_ICON_BUTTON_CLASSES_32}
                            triggerAriaLabel="Delete"
                            title="Delete measurement"
                            description="This removes this measurement. This can't be undone."
                            confirmLabel="Delete"
                            action={deleteBodyMetric.bind(null, entry.id)}
                          />
                        </div>
                        <div className="shrink-0 sm:hidden">
                          <CardMenu>
                            <BodyMetricFields
                              today={today}
                              unitSystem={unitSystem}
                              entry={entry}
                              returnTo="/profile#metrics"
                              triggerVariant="menu-item"
                            />
                            <ConfirmModal
                              trigger={
                                <>
                                  <X className="h-4 w-4" aria-hidden="true" />
                                  Delete
                                </>
                              }
                              triggerClassName={MENU_ITEM_DANGER_CLASSES}
                              title="Delete measurement"
                              description="This removes this measurement. This can't be undone."
                              confirmLabel="Delete"
                              action={deleteBodyMetric.bind(null, entry.id)}
                            />
                          </CardMenu>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ),
            }));

            return (
              <>
                {/* Mobile: the tabs and reading lists are unchanged, just
                    collapsed by default behind one "All readings" summary
                    — still server-rendered (BodyMetricTypeTabs only ever
                    toggles which already-rendered wrapper loses `hidden`;
                    nothing here fetches on the client), so this is a plain
                    disclosure, not a new client data path.
                    `group flex flex-col` plus `order-2` on the summary and
                    `order-1` on the content wrapper puts the tabs above the
                    button instead of below it — a native <details> always
                    renders <summary> first in DOM order, so this is a pure
                    CSS reorder, not a different disclosure mechanism;
                    `gap-3` on the <details> itself (rather than a margin on
                    one specific child) supplies the space between whichever
                    two elements end up adjacent in *visual* order. The two
                    <span>s inside the summary swap via `group-open:`
                    (Tailwind's variant for a `group`-marked ancestor's own
                    `[open]` state reaching a descendant) rather than the
                    plain `open:` variant, which only ever targets the
                    element that carries the `[open]` attribute itself — the
                    spans are descendants of it, not that element, so only
                    the group-scoped variant can reach them. No client state
                    anywhere in this. */}
                <details className="group flex flex-col gap-3 sm:hidden">
                  <summary className={`order-2 ${DISCLOSURE_SUMMARY_CLASSES}`}>
                    <span className="group-open:hidden">All readings</span>
                    <span className="hidden group-open:inline">Hide readings</span>
                  </summary>
                  <div className="order-1">
                    <BodyMetricTypeTabs tabs={tabs} />
                  </div>
                </details>
                {/* Desktop: the same tabs, always visible, no disclosure —
                    a separate unconditional render rather than a responsive
                    override of the details' own content, for the same
                    reason GoalsList's extra-goals grid is separate from its
                    mobile disclosure (see that file's own comment). */}
                <div className="hidden sm:block">
                  <BodyMetricTypeTabs tabs={tabs} />
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* Always mounted, in this one place, regardless of isEmpty — see this
          file's own doc comment for why. */}
      <div>
        <BodyMetricFields today={today} unitSystem={unitSystem} />
      </div>
    </section>
  );
}

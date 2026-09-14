import { X } from "lucide-react";
import { getExerciseCatalog } from "@/lib/exercises";
import {
  getDistinctCustomNamesForUser,
  getPersonalRecordsForUser,
} from "@/lib/personal-records";
import { groupPersonalRecordsBySubject } from "@/lib/personal-records-grouping";
import { formatPersonalRecordValueText } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import ConfirmModal from "../_components/ConfirmModal";
import PersonalRecordFields from "./PersonalRecordFields";
import { deletePersonalRecord } from "./personal-records-actions";

const DELETE_ICON_BUTTON_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-danger active:bg-surface-3 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

type PersonalRecordsListProps = {
  userId: string;
};

/**
 * Its own bordered section (rounded-xl surface-1 panel, matching /stats'
 * panels), fetching its own data the same way EventsList/GoalsList/
 * BodyMetricsList do rather than page.tsx owning a shared wrapper. Existing
 * personal records, grouped by subject (exercise or custom name) via
 * groupPersonalRecordsBySubject and rendered as a table — one row per
 * subject showing only the current best, with any earlier attempts for
 * that subject collapsed behind a native `<details>` disclosure (same
 * JS-free toggle GoalsList uses for archived goals and EventsList for past
 * events) rather than listed inline — every earlier attempt stays just as
 * editable and deletable once expanded, in the same `sm:grid-cols-[1fr_
 * 110px_110px_72px]` column structure as the best row above it (value under
 * "Best", date under "Set on", actions in the same right-hand column, the
 * exercise column indented one level via `pl-3`). The `<details>` sits
 * *after* the best row, as its own sibling — not nested inside the best
 * row's own "Exercise" cell — and each earlier attempt is its own top-level
 * `sm:grid-cols-[1fr_110px_110px_72px]` row, not one shared list nested
 * inside a single grid cell: nesting the whole template inside a `1fr` cell
 * forced that cell to fit 110+110+72px of fixed columns within a fraction
 * of the row's width, which widened the "Exercise" column — and with it the
 * whole section, squeezing Body metrics beside it — the moment an attempt
 * was expanded. Every row using the identical template against the same
 * full row width, rather than one grid nested inside another, is what keeps
 * the section's width unchanged whether a disclosure is open or not.
 * `userId` arrives as a prop from
 * ProfilePage rather than a local requireUser() call — same pattern as
 * /stats. Each value is converted for display via formatPersonalRecordValue
 * and the viewing user's unitSystem (getUserContext) — the stored value
 * stays kg/m/reps/seconds regardless. `isHyroxStation` is constant across a
 * group (it's a property of the subject's exercise, not the individual
 * record), so it's read once from `group.best.exercise` and reused for
 * every entry in that group. Each row's Edit trigger embeds a
 * PersonalRecordFields instance directly (entry={entry}) — same one-modal-
 * per-row wiring as GoalsList/EventsList, since PersonalRecordFields
 * already owns its own open/close state and useActionState call. `catalog`
 * and `today`, fetched here, also seed this section's own header Add
 * trigger. Every delete (the header's own empty-state CTA aside) is
 * confirmed via ConfirmModal.
 *
 * The hero's own PersonalRecordFields instance (ctaLabel="Add a record") is
 * rendered *unconditionally* — every render, regardless of `isEmpty` — with
 * only its own trigger button hidden (via the `hidden` prop, applied to
 * that one `<button>`, never a wrapping element) once a record exists. See
 * GoalsList's and BodyMetricsList's own doc comments for the full
 * rationale: PersonalRecordFields owns its own useActionState result and
 * the `successCount` driving its `FormSuccessBanner`, and the save that
 * creates a user's first-ever record is also the save that flips `isEmpty`
 * false in the same transition — an `{isEmpty && <hero/>}` block would
 * unmount that exact instance, discarding the just-set success state,
 * before the browser ever painted the "Saved" banner it had set up to
 * show.
 */
export default async function PersonalRecordsList({
  userId,
}: PersonalRecordsListProps) {
  const [records, catalog, customNames, { today, unitSystem }] = await Promise.all([
    getPersonalRecordsForUser(userId),
    getExerciseCatalog(),
    getDistinctCustomNamesForUser(userId),
    getUserContext(userId),
  ]);

  const isEmpty = records.length === 0;
  const groups = groupPersonalRecordsBySubject(records);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-ink">Personal records</h2>
        {!isEmpty && (
          <PersonalRecordFields
            catalog={catalog}
            customNames={customNames}
            today={today}
            unitSystem={unitSystem}
          />
        )}
      </div>

      {isEmpty && (
        <p className="text-sm text-ink-subtle">
          Your best 5k, lift or erg piece. Records can also be used as
          goal targets.
        </p>
      )}

      {/* Always mounted, regardless of isEmpty — see this file's own doc
          comment for why. `hidden` disables only this button once a record
          exists; FormSuccessBanner (a plain sibling inside
          PersonalRecordFields) is never affected by it, so the save that
          creates the first record can still show "Saved" even though
          isEmpty flips false in that same render. */}
      <div>
        <PersonalRecordFields
          catalog={catalog}
          customNames={customNames}
          today={today}
          unitSystem={unitSystem}
          ctaLabel="Add a record"
          hidden={!isEmpty}
        />
      </div>

      {!isEmpty && (
        <div className="flex flex-col">
          <div className="hidden gap-4 border-b border-surface-3 pb-2 text-[11px] uppercase tracking-wider text-ink-tertiary sm:grid sm:grid-cols-[1fr_110px_110px_72px]">
            <span>Exercise</span>
            <span>Best</span>
            <span>Set on</span>
            <span />
          </div>

          {groups.map((group) => {
            const rest = group.history.filter((r) => r.id !== group.best.id);
            const isHyroxStation = group.best.exercise?.isHyroxStation ?? false;
            const bestText = formatPersonalRecordValueText(
              group.recordType,
              group.best.value,
              unitSystem,
              isHyroxStation
            );

            return (
              <div key={group.subjectKey} className="border-b border-surface-3 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:grid sm:grid-cols-[1fr_110px_110px_72px] sm:items-center">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-ink-muted">
                      {group.subjectLabel}
                    </p>
                    {group.best.notes && (
                      <p className="break-words text-xs text-ink-tertiary">
                        {group.best.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-ink">{bestText}</span>
                  <span className="text-xs text-ink-tertiary">{group.best.achievedAt}</span>
                  <div className="flex shrink-0 items-center gap-1.5 sm:justify-end">
                    <PersonalRecordFields
                      catalog={catalog}
                      customNames={customNames}
                      today={today}
                      unitSystem={unitSystem}
                      entry={group.best}
                    />
                    <ConfirmModal
                      trigger={<X className="h-4 w-4" aria-hidden="true" />}
                      triggerClassName={DELETE_ICON_BUTTON_CLASSES}
                      triggerAriaLabel="Delete"
                      title="Delete record"
                      description="This removes this record. If it was the current best for this exercise, the next-best one takes its place. This can't be undone."
                      confirmLabel="Delete"
                      action={deletePersonalRecord.bind(null, group.best.id)}
                    />
                  </div>
                </div>

                {rest.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-ink-tertiary hover:text-ink-subtle">
                      {rest.length} earlier attempt{rest.length === 1 ? "" : "s"}
                    </summary>
                    <div className="mt-2 flex flex-col">
                      {rest.map((entry) => {
                        const entryText = formatPersonalRecordValueText(
                          group.recordType,
                          entry.value,
                          unitSystem,
                          isHyroxStation
                        );

                        return (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-surface-3 py-2 last:border-b-0 sm:grid sm:grid-cols-[1fr_110px_110px_72px] sm:items-center"
                          >
                            <div className="min-w-0 pl-3">
                              {entry.notes && (
                                <p className="break-words text-xs text-ink-tertiary">
                                  {entry.notes}
                                </p>
                              )}
                            </div>
                            <span className="text-sm text-ink-muted">{entryText}</span>
                            <span className="text-xs text-ink-tertiary">{entry.achievedAt}</span>
                            <div className="flex shrink-0 items-center gap-1.5 sm:justify-end">
                              <PersonalRecordFields
                                catalog={catalog}
                                customNames={customNames}
                                today={today}
                                unitSystem={unitSystem}
                                entry={entry}
                              />
                              <ConfirmModal
                                trigger={<X className="h-4 w-4" aria-hidden="true" />}
                                triggerClassName={DELETE_ICON_BUTTON_CLASSES}
                                triggerAriaLabel="Delete"
                                title="Delete record"
                                description="This removes this record. This can't be undone."
                                confirmLabel="Delete"
                                action={deletePersonalRecord.bind(null, entry.id)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

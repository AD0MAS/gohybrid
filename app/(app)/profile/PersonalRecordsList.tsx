import { X } from "lucide-react";
import { formatDayMonthShort } from "@/lib/dates";
import { getExerciseCatalog } from "@/lib/exercises";
import {
  getDistinctCustomNamesForUser,
  getPersonalRecordsForUser,
} from "@/lib/personal-records";
import { groupPersonalRecordsBySubject } from "@/lib/personal-records-grouping";
import { formatPersonalRecordValueText } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import ConfirmModal from "../_components/ConfirmModal";
import CardMenu, { MENU_ITEM_DANGER_CLASSES } from "../_components/CardMenu";
import PersonalRecordFields from "./PersonalRecordFields";
import { deletePersonalRecord } from "./personal-records-actions";
import { DANGER_ICON_BUTTON_CLASSES_32, PANEL_CLASSES } from "../_components/shared-classes";


type PersonalRecordsListProps = {
  userId: string;
};

/**
 * Its own bordered section (rounded-panel surface-1 panel, matching /stats'
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
 * and `today`, fetched here, also seed this section's own "Add record"
 * button, a full-width footer. Every delete is confirmed via ConfirmModal.
 *
 * Below `sm` each row is a single flex row, never wrapping: the exercise
 * column is the only flexible one (`min-w-0 flex-1`, wrapping via
 * `break-words`), while the best value, the date and the actions are all
 * `shrink-0 whitespace-nowrap`, so a long exercise name or note never pushes
 * the value/date/actions onto their own line. The date itself renders two
 * spans toggled by breakpoint — `formatDayMonthShort` (e.g. "6 Sep") below
 * `sm`, where the raw stored date doesn't reliably fit at 320px, and the
 * unformatted value from `sm` up, where the fixed 110px column already
 * fits it — rather than reformatting unconditionally, so the desktop
 * column is unchanged. Edit and Delete collapse into one CardMenu below
 * `sm` (PersonalRecordFields' `triggerVariant="menu-item"`, same pattern as
 * GoalsList's card menu) and stay separate icon buttons from `sm` up,
 * exactly as before.
 *
 * The one "Add record" PersonalRecordFields is rendered *unconditionally*,
 * in the same spot after the list, whether or not `isEmpty` — never inside
 * an `{isEmpty && …}` or `{!isEmpty && …}` block. It owns its own
 * useActionState result and the `successCount` driving its
 * `FormSuccessBanner`, and the save that creates a user's first-ever record
 * is also the save that flips `isEmpty` false in the same transition: a
 * conditional would unmount that exact instance, discarding the just-set
 * success state, before the browser ever painted the "Saved" banner.
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
    <section
      id="records"
      className={PANEL_CLASSES}
    >
      <h2 className="text-section font-semibold text-ink">Personal records</h2>

      {isEmpty && (
        <p className="text-sm text-ink-subtle">
          Your best 5k, lift or erg piece. Records can also be used as
          goal targets.
        </p>
      )}

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
                <div className="flex items-start gap-x-4 gap-y-1 sm:grid sm:grid-cols-[1fr_110px_110px_72px] sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-ink-muted">
                      {group.subjectLabel}
                    </p>
                    {group.best.notes && (
                      <p className="break-words text-xs text-ink-tertiary">
                        {group.best.notes}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink sm:whitespace-normal">
                    {bestText}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-ink-tertiary sm:whitespace-normal">
                    <span className="sm:hidden">{formatDayMonthShort(group.best.achievedAt)}</span>
                    <span className="hidden sm:inline">{group.best.achievedAt}</span>
                  </span>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex sm:justify-end">
                    <PersonalRecordFields
                      catalog={catalog}
                      customNames={customNames}
                      today={today}
                      unitSystem={unitSystem}
                      entry={group.best}
                      returnTo="/profile#records"
                    />
                    <ConfirmModal
                      trigger={<X className="h-4 w-4" aria-hidden="true" />}
                      triggerClassName={DANGER_ICON_BUTTON_CLASSES_32}
                      triggerAriaLabel="Delete"
                      title="Delete record"
                      description="This removes this record. If it was the current best for this exercise, the next-best one takes its place. This can't be undone."
                      confirmLabel="Delete"
                      action={deletePersonalRecord.bind(null, group.best.id)}
                    />
                  </div>
                  <div className="shrink-0 sm:hidden">
                    <CardMenu>
                      <PersonalRecordFields
                        catalog={catalog}
                        customNames={customNames}
                        today={today}
                        unitSystem={unitSystem}
                        entry={group.best}
                        returnTo="/profile#records"
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
                        title="Delete record"
                        description="This removes this record. If it was the current best for this exercise, the next-best one takes its place. This can't be undone."
                        confirmLabel="Delete"
                        action={deletePersonalRecord.bind(null, group.best.id)}
                      />
                    </CardMenu>
                  </div>
                </div>

                {rest.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-ink-tertiary hover:text-ink-subtle active:text-ink-subtle">
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
                            className="flex items-start gap-x-4 gap-y-1 border-b border-surface-3 py-2 last:border-b-0 sm:grid sm:grid-cols-[1fr_110px_110px_72px] sm:items-center"
                          >
                            <div className="min-w-0 flex-1 pl-3">
                              {entry.notes && (
                                <p className="break-words text-xs text-ink-tertiary">
                                  {entry.notes}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 whitespace-nowrap text-sm text-ink-muted sm:whitespace-normal">
                              {entryText}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-xs text-ink-tertiary sm:whitespace-normal">
                              <span className="sm:hidden">{formatDayMonthShort(entry.achievedAt)}</span>
                              <span className="hidden sm:inline">{entry.achievedAt}</span>
                            </span>
                            <div className="hidden shrink-0 items-center gap-1.5 sm:flex sm:justify-end">
                              <PersonalRecordFields
                                catalog={catalog}
                                customNames={customNames}
                                today={today}
                                unitSystem={unitSystem}
                                entry={entry}
                                returnTo="/profile#records"
                              />
                              <ConfirmModal
                                trigger={<X className="h-4 w-4" aria-hidden="true" />}
                                triggerClassName={DANGER_ICON_BUTTON_CLASSES_32}
                                triggerAriaLabel="Delete"
                                title="Delete record"
                                description="This removes this record. This can't be undone."
                                confirmLabel="Delete"
                                action={deletePersonalRecord.bind(null, entry.id)}
                              />
                            </div>
                            <div className="shrink-0 sm:hidden">
                              <CardMenu>
                                <PersonalRecordFields
                                  catalog={catalog}
                                  customNames={customNames}
                                  today={today}
                                  unitSystem={unitSystem}
                                  entry={entry}
                                  returnTo="/profile#records"
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
                                  title="Delete record"
                                  description="This removes this record. This can't be undone."
                                  confirmLabel="Delete"
                                  action={deletePersonalRecord.bind(null, entry.id)}
                                />
                              </CardMenu>
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

      {/* Always mounted, in this one place, regardless of isEmpty — see this
          file's own doc comment for why. */}
      <div>
        <PersonalRecordFields
          catalog={catalog}
          customNames={customNames}
          today={today}
          unitSystem={unitSystem}
        />
      </div>
    </section>
  );
}

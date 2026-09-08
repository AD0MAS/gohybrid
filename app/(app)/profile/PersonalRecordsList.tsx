import { X } from "lucide-react";
import { SubmitButton } from "@/app/_components/FormStatus";
import { getExerciseCatalog } from "@/lib/exercises";
import {
  getDistinctCustomNamesForUser,
  getPersonalRecordsForUser,
} from "@/lib/personal-records";
import { groupPersonalRecordsBySubject } from "@/lib/personal-records-grouping";
import { formatPersonalRecordValueText } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import PersonalRecordFields from "./PersonalRecordFields";
import { deletePersonalRecord } from "./personal-records-actions";

type PersonalRecordsListProps = {
  userId: string;
};

/**
 * Existing personal records, grouped by subject (exercise or custom name)
 * via groupPersonalRecordsBySubject, with the current best shown
 * prominently and the rest of that subject's history underneath — each row
 * deletable. `userId` arrives as a prop from ProfilePage rather than a
 * local requireUser() call — same pattern as /stats. Each value is
 * converted for display via formatPersonalRecordValue and the viewing
 * user's unitSystem (getUserContext) — the stored value stays
 * kg/m/reps/seconds regardless. `isHyroxStation` is constant across a
 * group (it's a property of the subject's exercise, not the individual
 * record), so it's read once from `group.best.exercise` and reused for
 * every entry in that group. Each row's Edit trigger embeds a
 * PersonalRecordFields instance directly (entry={entry}) — same one-modal-
 * per-row wiring as GoalsList/EventsList, since PersonalRecordFields
 * already owns its own open/close state and useActionState call. `catalog`
 * and `today` are fetched here too (not just in PersonalRecordForm) so
 * every row's embedded PersonalRecordFields has what it needs, same as
 * PersonalRecordForm's own fetch.
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

  if (records.length === 0) {
    return (
      <p className="text-sm text-ink-subtle">
        No personal records yet. Add one above to start tracking.
      </p>
    );
  }

  const groups = groupPersonalRecordsBySubject(records);

  return (
    <div className="flex flex-col gap-4">
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
          <div key={group.subjectKey} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{group.subjectLabel}</h3>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-hairline-strong bg-surface-2 p-5">
              <div>
                <p className="text-sm font-semibold">
                  Best: {bestText} · {group.best.achievedAt}
                </p>
                {group.best.notes && (
                  <p className="text-sm text-ink-subtle">{group.best.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PersonalRecordFields
                  catalog={catalog}
                  customNames={customNames}
                  today={today}
                  unitSystem={unitSystem}
                  entry={group.best}
                />
                <form action={deletePersonalRecord.bind(null, group.best.id)}>
                  <SubmitButton
                    ariaLabel="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger active:bg-surface-2 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </SubmitButton>
                </form>
              </div>
            </div>

            {rest.length > 0 && (
              <ul className="flex flex-col gap-2 pl-3">
                {rest.map((entry) => {
                  const entryText = formatPersonalRecordValueText(
                    group.recordType,
                    entry.value,
                    unitSystem,
                    isHyroxStation
                  );

                  return (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-1 p-5"
                    >
                      <div>
                        <p className="text-sm">
                          {entryText} · {entry.achievedAt}
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-ink-subtle">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <PersonalRecordFields
                          catalog={catalog}
                          customNames={customNames}
                          today={today}
                          unitSystem={unitSystem}
                          entry={entry}
                        />
                        <form action={deletePersonalRecord.bind(null, entry.id)}>
                          <SubmitButton
                            ariaLabel="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger active:bg-surface-2 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getExerciseCatalog } from "@/lib/exercises";
import {
  getPersonalRecordsForUser,
  groupPersonalRecordsBySubject,
} from "@/lib/personal-records";
import { formatPersonalRecordValue } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
import PersonalRecordFields from "./PersonalRecordFields";
import { deletePersonalRecord } from "./personal-records-actions";

/**
 * Existing personal records, grouped by subject (exercise or custom name)
 * via groupPersonalRecordsBySubject, with the current best shown
 * prominently and the rest of that subject's history underneath — each row
 * deletable. Fetches its own data given `userId` via requireUser(), same
 * self-fetching convention as BodyMetricsList. Each value is converted for
 * display via formatPersonalRecordValue and the viewing user's unitSystem
 * (getUserContext) — the stored value stays kg/m/reps/seconds regardless.
 * `isHyroxStation` is constant across a group (it's a property of the
 * subject's exercise, not the individual record), so it's read once from
 * `group.best.exercise` and reused for every entry in that group. Each
 * row's Edit trigger embeds a PersonalRecordFields instance directly
 * (entry={entry}) — same one-modal-per-row wiring as GoalsList/EventsList,
 * since PersonalRecordFields already owns its own open/close state and
 * useActionState call. `catalog` and `today` are fetched here too (not
 * just in PersonalRecordForm) so every row's embedded PersonalRecordFields
 * has what it needs, same as PersonalRecordForm's own fetch.
 */
export default async function PersonalRecordsList() {
  const user = await requireUser();
  const [records, catalog, { today, unitSystem }] = await Promise.all([
    getPersonalRecordsForUser(user.id),
    getExerciseCatalog(),
    getUserContext(user.id),
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
        const bestDisplay = formatPersonalRecordValue(
          group.recordType,
          group.best.value,
          unitSystem,
          isHyroxStation
        );

        return (
          <div key={group.subjectKey} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{group.subjectLabel}</h3>

            <div className="flex items-center justify-between gap-2 rounded border border-hairline-strong bg-surface-2 p-5">
              <div>
                <p className="text-sm font-semibold">
                  Best: {bestDisplay.value} {bestDisplay.unit} ·{" "}
                  {group.best.achievedAt}
                </p>
                {group.best.notes && (
                  <p className="text-sm text-ink-subtle">{group.best.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PersonalRecordFields
                  catalog={catalog}
                  today={today}
                  unitSystem={unitSystem}
                  entry={group.best}
                />
                <form action={deletePersonalRecord.bind(null, group.best.id)}>
                  <button
                    type="submit"
                    aria-label="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>
              </div>
            </div>

            {rest.length > 0 && (
              <ul className="flex flex-col gap-2 pl-3">
                {rest.map((entry) => {
                  const display = formatPersonalRecordValue(
                    group.recordType,
                    entry.value,
                    unitSystem,
                    isHyroxStation
                  );

                  return (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 rounded border border-hairline bg-surface-1 p-5"
                    >
                      <div>
                        <p className="text-sm">
                          {display.value} {display.unit} · {entry.achievedAt}
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-ink-subtle">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <PersonalRecordFields
                          catalog={catalog}
                          today={today}
                          unitSystem={unitSystem}
                          entry={entry}
                        />
                        <form action={deletePersonalRecord.bind(null, entry.id)}>
                          <button
                            type="submit"
                            aria-label="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
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

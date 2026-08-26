import { requireUser } from "@/lib/auth";
import {
  getPersonalRecordsForUser,
  groupPersonalRecordsBySubject,
} from "@/lib/personal-records";
import { formatPersonalRecordValue } from "@/lib/units";
import { getUserContext } from "@/lib/user-settings";
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
 * `group.best.exercise` and reused for every entry in that group.
 */
export default async function PersonalRecordsList() {
  const user = await requireUser();
  const [records, { unitSystem }] = await Promise.all([
    getPersonalRecordsForUser(user.id),
    getUserContext(user.id),
  ]);

  if (records.length === 0) {
    return (
      <p className="text-sm text-gray-600">
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

            <div className="flex items-center justify-between gap-2 rounded border border-gray-300 bg-gray-50 p-3">
              <div>
                <p className="text-sm font-semibold">
                  Best: {bestDisplay.value} {bestDisplay.unit} ·{" "}
                  {group.best.achievedAt}
                </p>
                {group.best.notes && (
                  <p className="text-sm text-gray-600">{group.best.notes}</p>
                )}
              </div>
              <form action={deletePersonalRecord.bind(null, group.best.id)}>
                <button type="submit" className="text-sm text-red-700 underline">
                  Delete
                </button>
              </form>
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
                      className="flex items-center justify-between gap-2 rounded border border-gray-200 p-3"
                    >
                      <div>
                        <p className="text-sm">
                          {display.value} {display.unit} · {entry.achievedAt}
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-gray-600">{entry.notes}</p>
                        )}
                      </div>
                      <form action={deletePersonalRecord.bind(null, entry.id)}>
                        <button
                          type="submit"
                          className="text-sm text-red-700 underline"
                        >
                          Delete
                        </button>
                      </form>
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

import {
  STATUS_DOT_CLASSES,
  STATUS_LABELS,
  type EntryStatus,
} from "./entry-status";

const LEGEND_ORDER: EntryStatus[] = ["completed", "planned", "skipped", "event"];

/** The dot legend at the foot of Home's calendar section: each status's dot,
 * from the same table the day cells read, with its label and no counts. */
export default function CalendarLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-surface-3 pt-3 text-[11px] text-ink-tertiary">
      {LEGEND_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[status]}`}
            aria-hidden="true"
          />
          {STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}

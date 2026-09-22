import Link from "next/link";
import { formatDayHeadingLong, getDayNumber } from "@/lib/dates";
import { STATUS_DOT_CLASSES, type EntryStatus } from "../entry-status";

/** Dots shown per cell before the rest collapse into "+N". */
const MAX_VISIBLE_DOTS = 3;

/** One entry in a day cell: a scheduled workout or an event, reduced to what
 * the cell draws. */
export type DayCellEntry = {
  id: string;
  title: string;
  status: EntryStatus;
};

type DayCellProps = {
  date: string;
  entries: DayCellEntry[];
  href: string;
  isToday: boolean;
  isSelected: boolean;
  /** An adjacent-month day in a month grid: shown, and still a link, but
   * quieter. Never set in the week strip — a week is not a month. */
  isDimmed: boolean;
};

/**
 * One day of Home's week strip or month calendar: the day number over up to
 * three status dots, in a bordered box that links to that day. Both surfaces
 * render this, so their states are one set:
 *
 * - default — hairline border, `surface-1` (`surface-2` when the day has
 *   entries);
 * - today — the accent border;
 * - selected — a tinted accent fill and a semibold number. Border and fill
 *   are different channels, so a selected today shows both;
 * - dimmed — canvas fill, faint border and number (an adjacent-month day in
 *   a month grid; a selected day is never dimmed);
 * - hover / active — one step lighter.
 *
 * The number and a fixed-height dots row are one centred group, and the row
 * is always rendered (empty when the day has no entries), so the number sits
 * in the same place in every cell.
 *
 * A Server Component: a plain `Link` with `scroll={false}`, no client JS.
 */
export default function DayCell({
  date,
  entries,
  href,
  isToday,
  isSelected,
  isDimmed,
}: DayCellProps) {
  const dimmed = isDimmed && !isSelected;
  const visibleDots = entries.slice(0, MAX_VISIBLE_DOTS);
  const hiddenDots = entries.length - visibleDots.length;

  // One choice per property (border, background, ink, hover), never two
  // utilities for the same one: Tailwind does not guarantee that source
  // order wins between them.
  const border = dimmed
    ? "border-surface-3"
    : isToday
      ? "border-accent"
      : "border-hairline";
  const background = dimmed
    ? "bg-canvas"
    : isSelected
      ? "bg-accent/15"
      : entries.length > 0
        ? "bg-surface-2"
        : "bg-surface-1";
  const hover = isSelected
    ? "hover:bg-accent/25 active:bg-accent/25"
    : "hover:bg-surface-3 active:bg-surface-3";
  const ink = dimmed
    ? "text-ink-tertiary"
    : isToday || isSelected
      ? "text-ink"
      : entries.length > 0
        ? "text-ink-muted"
        : "text-ink-subtle";
  const weight = isSelected ? "font-semibold" : "font-medium";

  const label = [
    formatDayHeadingLong(date),
    isToday ? "today" : null,
    isSelected ? "selected" : null,
    entries.length > 0
      ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      aria-current={isToday ? "date" : undefined}
      className={`flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-small border p-0.5 ${border} ${background} ${ink} ${hover} focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus`}
    >
      <span className={`text-xs leading-none ${weight}`}>{getDayNumber(date)}</span>

      <span className="flex h-2 items-center justify-center gap-0.5" aria-hidden="true">
        {visibleDots.map((entry) => (
          <span
            key={entry.id}
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASSES[entry.status]}`}
          />
        ))}
        {hiddenDots > 0 && (
          <span className="text-[9px] leading-none text-ink-subtle">+{hiddenDots}</span>
        )}
      </span>
    </Link>
  );
}

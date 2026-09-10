type SummaryCardProps = {
  label: string;
  value: number;
  variant?: "default" | "compact";
};

/**
 * Single stat tile — a label and a number. Shared between /stats'
 * SummaryCards (all five cards) and the Home page (this week, this month,
 * current streak only), so the two can't render the same numbers with
 * different markup. The "compact" variant is mobile-first — tighter
 * padding and a muted label below `sm`, reverting to the default look
 * from `sm` up — used only by /stats, so a two-row mobile layout fits
 * without changing anything at sm and above.
 */
export default function SummaryCard({
  label,
  value,
  variant = "default",
}: SummaryCardProps) {
  const padding = variant === "compact" ? "px-3 py-2.5 sm:p-5" : "p-5";
  const labelColor =
    variant === "compact"
      ? "text-ink-muted sm:text-ink-subtle"
      : "text-ink-subtle";

  return (
    <div className={`rounded-lg border border-accent bg-surface-1 ${padding}`}>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className={`text-xs ${labelColor}`}>{label}</p>
    </div>
  );
}

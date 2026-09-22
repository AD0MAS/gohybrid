type SummaryCardProps = {
  label: string;
  value: number;
};

/**
 * Single stat tile — a label and a number, used by /stats' SummaryCards
 * (all five cards). Mobile-first: tighter padding and a muted label below
 * `sm`, reverting to the default look from `sm` up, so a two-row mobile
 * layout fits without changing anything at `sm` and above.
 */
export default function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-card border border-hairline bg-surface-2 px-3 py-2.5 sm:p-5">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-muted sm:text-ink-subtle">{label}</p>
    </div>
  );
}

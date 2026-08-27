type SummaryCardProps = {
  label: string;
  value: number;
};

/**
 * Single stat tile — a label and a number. Shared between /stats'
 * SummaryCards (all five cards) and the Home page (this week, this month,
 * current streak only), so the two can't render the same numbers with
 * different markup.
 */
export default function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded border border-gray-300 p-5">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}

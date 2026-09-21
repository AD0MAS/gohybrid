import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const ARROW_CLASSES =
  "flex h-8 w-8 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

type NavHeaderProps = {
  heading: string;
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
};

/**
 * "‹ heading ›": the header of Home's week strip and month calendar — the
 * arrows at the sides, the heading centred between them. One component, so
 * the two panels' headers cannot drift. Plain `Link`s with `scroll={false}`:
 * stepping the view keeps the page where it is, with no client JS.
 */
export default function NavHeader({
  heading,
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: NavHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <Link href={prevHref} scroll={false} aria-label={prevLabel} className={ARROW_CLASSES}>
        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </Link>
      <h2 className="text-sm font-medium text-ink">{heading}</h2>
      <Link href={nextHref} scroll={false} aria-label={nextLabel} className={ARROW_CLASSES}>
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
      </Link>
    </div>
  );
}

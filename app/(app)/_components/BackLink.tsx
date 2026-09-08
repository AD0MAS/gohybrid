import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type BackLinkProps = {
  href: string;
  label: string;
};

/**
 * App-wide back control (GOHYBRID_PLAN.md §9 step 38): a plain Link to a
 * fixed parent route, not router.back() — zero client JavaScript, a
 * predictable destination, and no risk of leaving the app when the page was
 * opened directly. Used only on pages with no navigation entry of their own
 * (§5A); the four top-level routes never render this. `label` names the
 * destination ("Workouts", "My Workouts") and becomes the accessible name
 * "Back to {label}", since "Back" alone doesn't say where.
 */
export default function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={`Back to ${label}`}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
    </Link>
  );
}

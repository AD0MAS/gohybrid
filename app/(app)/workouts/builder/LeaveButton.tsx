import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "../../_components/ConfirmModal";

type LeaveButtonProps = {
  /** Where leaving goes: the same destination as the page's back link. */
  href: string;
  /** Whether the builder differs from the state it opened in. */
  dirty: boolean;
  className: string;
  /** Accessible name, for an icon-only control (the back button). */
  ariaLabel?: string;
  children: React.ReactNode;
};

/**
 * Leaves the builder without saving — the one implementation behind both
 * Discard and the header's back control. A pristine builder just navigates; a
 * changed one asks first, through the same ConfirmModal every destructive
 * action in the app uses, and only then navigates. Rendered outside the
 * builder's <form> — ConfirmModal brings its own <form>, and forms cannot
 * nest. Not a "use client" file: it is only rendered from WorkoutBuilder,
 * already inside that boundary.
 */
export default function LeaveButton({
  href,
  dirty,
  className,
  ariaLabel,
  children,
}: LeaveButtonProps) {
  const router = useRouter();

  if (!dirty) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <ConfirmModal
      trigger={children}
      triggerClassName={className}
      triggerAriaLabel={ariaLabel}
      title="Discard changes?"
      description="Your unsaved changes to this workout will be lost."
      confirmLabel="Discard"
      action={async () => {
        router.push(href);
      }}
    />
  );
}

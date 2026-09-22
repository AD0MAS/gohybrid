"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/app/(app)/_components/ConfirmModal";

type StartLeaveButtonProps = {
  /** Where leaving goes: the workout's own page, the route's parent. */
  href: string;
  /** Whether leaving must ask first (see shouldConfirmLeave). */
  needsConfirm: boolean;
  /** Clears the stored Start state; runs on every way out. */
  onLeave: () => void;
  className: string;
  /** Accessible name, for an icon-only control (the ✕). */
  ariaLabel?: string;
  children: React.ReactNode;
};

/**
 * Leaves Start Mode without finishing — the one implementation behind both
 * the header ✕ and Discard, as LeaveButton is for the builder. When there is
 * little to lose (nothing ticked, under a minute on the clock) it just
 * navigates; otherwise it asks first, through the same ConfirmModal every
 * destructive action uses, and only then navigates. Either way the stored
 * state is cleared.
 */
export default function StartLeaveButton({
  href,
  needsConfirm,
  onLeave,
  className,
  ariaLabel,
  children,
}: StartLeaveButtonProps) {
  const router = useRouter();

  if (!needsConfirm) {
    return (
      <Link
        href={href}
        onClick={onLeave}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </Link>
    );
  }

  return (
    <ConfirmModal
      trigger={children}
      triggerClassName={className}
      triggerAriaLabel={ariaLabel}
      title="Discard this workout?"
      description="Your progress and time won't be saved."
      cancelLabel="Keep going"
      confirmLabel="Discard"
      pendingLabel="Discarding…"
      action={async () => {
        onLeave();
        router.push(href);
      }}
    />
  );
}

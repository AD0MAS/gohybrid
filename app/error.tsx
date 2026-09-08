"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root error boundary — catches any render or Server Action error thrown
 * beneath the root layout that isn't handled closer to where it occurred
 * (see FavoriteToggle for an example of a component that deliberately
 * catches its own failure instead of relying on this). Shows a generic
 * message rather than `error.message`, since that string can contain
 * details not meant for the end user; the actual error still reaches the
 * console for debugging. `reset` re-renders the segment without a full
 * page reload, which is enough to recover from most transient failures.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-ink">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-ink-subtle">
        An unexpected error occurred. You can try again, or go back home.
      </p>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover active:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Try again
        </button>
        <Link
          href="/"
          className="self-center text-sm text-ink-subtle underline hover:text-ink active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}

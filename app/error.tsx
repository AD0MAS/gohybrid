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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-gray-600">
        An unexpected error occurred. You can try again, or go back home.
      </p>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link href="/" className="text-sm underline self-center">
          Go home
        </Link>
      </div>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Last-resort error boundary for errors thrown by the root layout itself
 * (app/layout.tsx) — app/error.tsx can't catch those, since it renders
 * *inside* the layout. Next.js requires this file to render its own
 * <html>/<body>, since the root layout that would normally provide them is
 * exactly what failed; it's kept unstyled for that reason, not by choice.
 * Same rule as app/error.tsx: no error detail shown to the user, console
 * carries it instead.
 */
export default function GlobalError({
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
    <html lang="en">
      <body style={{ background: "#010102", margin: 0 }}>
        <main
          style={{
            maxWidth: 384,
            margin: "0 auto",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            fontFamily: "sans-serif",
            color: "#f7f8f8",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#8a8f98" }}>
            An unexpected error occurred. You can try again, or go back home.
          </p>

          <div style={{ display: "flex", gap: 16 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                borderRadius: 8,
                background: "#5e6ad2",
                color: "white",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                fontSize: 14,
                color: "#8a8f98",
                textDecoration: "underline",
                alignSelf: "center",
              }}
            >
              Go home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}

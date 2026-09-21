import type { Viewport } from "next";

// Lets the page extend under the phone's notch and home indicator; the Start
// header and bottom bar pad themselves with env(safe-area-inset-*). Scoped to
// this group so the rest of the app keeps the default viewport.
export const viewport: Viewport = {
  viewportFit: "cover",
};

/**
 * Shell for full-screen focus routes: no sidebar, no bottom bar, no gutters —
 * the page owns the whole viewport. It deliberately does not call
 * requireUser(): proxy.ts already redirects a signed-out visitor, and each
 * page and Server Action here authenticates itself, so a layout check would
 * only add a second Supabase round trip.
 */
export default function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

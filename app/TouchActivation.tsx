"use client";

import { useEffect } from "react";

/**
 * iOS Safari only runs the CSS :active phase on an element that has a touch
 * handler on itself or an ancestor — without one it treats a tap as a plain
 * click with no active state at all. body's own -webkit-tap-highlight-color:
 * transparent (globals.css) already turns off the native flash, so every
 * hover:/active: pair in the app depends on :active actually firing; this is
 * the one listener that makes it do so, app-wide. No-op and passive: it
 * exists purely for WebKit's own activation quirk, never to read or block a
 * touch.
 */
export default function TouchActivation() {
  useEffect(() => {
    function noop() {}
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);

  return null;
}

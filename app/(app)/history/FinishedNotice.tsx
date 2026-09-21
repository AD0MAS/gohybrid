"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

type FinishedNoticeProps = {
  /** Whether the page was reached with `?finished=1` and has a session to
   * name. */
  show: boolean;
  /** The newest session's title — the one Finish just wrote. */
  title: string;
  /** Identifies this particular finish (the newest session's id), so a second
   * finish that lands on this still-mounted page is a different notice. */
  nonce: string;
};

/**
 * The "Finished" panel at the top of /history after Start's Finish button
 * (`?finished=1`): a ✓, "Finished", which session was written, and a ✕ that
 * closes it. Unlike RedirectSuccessBanner it does not time out — it is part
 * of the page, not a toast — but it borrows that component's two ideas.
 *
 * The param is stripped with `history.replaceState` in a mount effect, so a
 * reload right after arriving shows a clean page (no navigation, no second
 * server round trip; see RedirectSuccessBanner for why not `router.replace`).
 *
 * It reacts to a change, not only to mount: search params don't remount an
 * App Router page, so a finish that lands on an already-mounted /history
 * arrives as new props. `token` is `null` when nothing should show, else the
 * finish's nonce; a render that sees a different non-null token than the last
 * one shows the notice again. A change to `null` (the param gone after a
 * re-render) deliberately does not hide it — only the ✕ does.
 *
 * The ✕ is a flex sibling of the message, centred on the row's cross axis, so
 * it stays vertically centred whether the message is one line or wraps to
 * several on a phone.
 */
export default function FinishedNotice({
  show,
  title,
  nonce,
}: FinishedNoticeProps) {
  const [visible, setVisible] = useState(show);

  const token = show ? nonce : null;
  const [prevToken, setPrevToken] = useState(token);
  if (token !== prevToken) {
    setPrevToken(token);
    if (token !== null) setVisible(true);
  }

  useEffect(() => {
    if (!show) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("finished");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [show, nonce]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-panel border border-hairline bg-surface-1 py-3 pl-4 pr-3"
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-success text-canvas">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <span className="text-[13px] font-medium text-ink-muted">Finished</span>
        <span className="min-w-0 break-words text-xs text-ink-tertiary sm:text-[13px]">
          {title} was written to your history.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-small text-ink-subtle hover:bg-surface-2 hover:text-ink active:bg-surface-2 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

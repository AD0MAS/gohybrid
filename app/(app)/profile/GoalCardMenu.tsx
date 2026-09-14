"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

// Same rest/hover/active colour behaviour as every other icon button in
// the app (ICON_BUTTON_CLASSES/DELETE_ICON_BUTTON_CLASSES in GoalsList and
// its siblings): text-ink-subtle at rest, text-ink on hover/active for a
// plain action, text-danger on hover/active only for the destructive one —
// never red at rest, since resting red would read as a warning already in
// effect rather than an action waiting to be taken.
export const MENU_ITEM_CLASSES =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";
export const MENU_ITEM_DANGER_CLASSES =
  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-subtle hover:bg-surface-3 hover:text-danger active:bg-surface-3 active:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

type GoalCardMenuProps = {
  children: React.ReactNode;
};

/**
 * A three-dot menu for a goal card's row of actions — Edit/Archive/Delete
 * used to be three separate icon buttons, which stopped fitting once the
 * card itself shrank to half the panel's width in the two-column grid. The
 * only reason this is a client component (unlike GoalsList itself, which
 * stays a Server Component): opening/closing a popover, and reacting to an
 * outside click or Escape, both need client state — there is no
 * server-renderable equivalent the way there is for the archived-goals/
 * past-events `<details>` disclosures elsewhere in /profile.
 *
 * `children` are whatever GoalsList composes for this specific row —
 * GoalFields with `triggerVariant="menu-item"` for Edit, a plain
 * `<form>`+`SubmitButton` for Archive (unchanged, still a one-click Server
 * Action), and a ConfirmModal for Delete (unchanged, still confirmed) — so
 * none of those three's own behaviour has to be reimplemented here. Passing
 * pre-rendered JSX like this as `children`, from GoalsList (a Server
 * Component) into this Client Component, is exactly the boundary-safe
 * pattern React supports: what can't cross is a *function* prop (a
 * `renderTrigger` callback GoalFields used to take, and GoalFields itself
 * would have had to invoke) — GoalCardMenu's own signature never needed to
 * change for this fix, only what got composed inside it. Closing
 * the menu after a choice doesn't need per-item callbacks threaded through
 * any of them: the menu panel's own onClick closes it for *any* click
 * inside, and that handler runs during the bubble phase after the item's
 * own onClick already fired (open the edit modal, submit the archive form,
 * open the confirm dialog) — so the dropdown closing never races or
 * interferes with what the item itself just did.
 *
 * Closes on Escape and on a click outside via a document-level listener,
 * attached only while `open` (removed on close/unmount) — the standard
 * "open a popover, listen while it's open" pattern, not a permanent
 * document listener. The trigger carries `aria-haspopup`/`aria-expanded`
 * and the panel `role="menu"`; every item is a real, unstyled-role
 * `<button>` (SubmitButton and ConfirmModal's own trigger both render one),
 * so Tab order alone makes the whole menu keyboard-reachable without any
 * roving-tabindex logic.
 *
 * The panel is always mounted — never `{open && <div>{children}</div>}` —
 * and toggles `invisible pointer-events-none` instead. `children` are
 * themselves stateful (GoalFields/ConfirmModal each keep their own "is my
 * modal open" state in local useState); a click on any of them fires two
 * handlers in the same event — the item's own (e.g. GoalFields' openFresh,
 * setting *its* `open` to true) during the target phase, then this panel's
 * (setting *this* `open` to false) during the bubble phase — and React
 * batches both into one re-render. Conditionally mounting the panel meant
 * that single re-render both flipped the item's state to "open" and
 * unmounted the item in the same tick, destroying the state it had just
 * set before a modal ever had the chance to exist — Edit, Archive and
 * Delete all failed this way, the form's Server Action worse than the
 * other two: React removed it from the DOM before the browser's separate,
 * later "submit" event ever reached it. Keeping the panel mounted and only
 * hiding it visually means the item components never unmount when the menu
 * closes around them, so whatever they just set (open their own Modal,
 * submit their own form) survives. `visible`/`pointer-events-auto` on
 * Modal's own `<dialog>` (see its doc comment) exist specifically to
 * counter this: `visibility` and `pointer-events` are inherited, so without
 * that reset a modal opened from inside an `invisible pointer-events-none`
 * closed panel would otherwise inherit both and render unusable even
 * though `showModal()` had promoted it to the top layer.
 */
export default function GoalCardMenu({ children }: GoalCardMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex h-8 w-8 items-center justify-center rounded-small border border-hairline bg-surface-2 text-ink-subtle hover:bg-surface-3 hover:text-ink active:bg-surface-3 active:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      <div
        id={menuId}
        role="menu"
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`absolute right-0 top-full z-20 mt-1 flex w-40 flex-col overflow-hidden rounded-card border border-hairline bg-surface-2 py-1 shadow-lg ${open ? "" : "invisible pointer-events-none"}`}
      >
        {children}
      </div>
    </div>
  );
}

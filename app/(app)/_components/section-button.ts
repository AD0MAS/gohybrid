/**
 * The button that closes a section: full width, text centred, at every
 * breakpoint — "Full history" under a list, "Add event" under Events. One
 * class string for `Link`s and `<button>`s alike, so every section footer
 * looks the same. Page-level buttons in a page header's corner are not this.
 */
export const SECTION_BUTTON_CLASSES =
  "flex h-10 w-full items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-center text-sm font-medium text-ink-muted hover:bg-surface-3 active:bg-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus";

/**
 * A section button that is currently inert — the same footprint as
 * SECTION_BUTTON_CLASSES, in the app's disabled-button look (as the
 * builder's disabled Save): faint text, `not-allowed` cursor, no hover. Put
 * it on a `<button disabled aria-disabled="true">`, never on a link.
 */
export const SECTION_BUTTON_DISABLED_CLASSES =
  "flex h-10 w-full cursor-not-allowed items-center justify-center rounded-control border border-hairline bg-surface-2 px-5 text-center text-sm font-medium text-ink-tertiary";

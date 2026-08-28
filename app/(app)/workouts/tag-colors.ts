import type { tagColorEnum } from "@/db/schema";

// Type-only import — erased at compile time, so this stays safe to import
// from the client-side builder as well as server-rendered pages.
export type TagColor = (typeof tagColorEnum.enumValues)[number];

/**
 * Tailwind classes per tag_color enum value. Centralized here so the
 * builder's tag selector, the workout detail page, and the workouts list
 * all render the same tag with the same colour.
 */
const NEUTRAL_TAG_CLASSES =
  "bg-surface-2 text-ink-muted border-hairline rounded-full";

export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  red: NEUTRAL_TAG_CLASSES,
  orange: NEUTRAL_TAG_CLASSES,
  green: NEUTRAL_TAG_CLASSES,
  blue: NEUTRAL_TAG_CLASSES,
  purple: NEUTRAL_TAG_CLASSES,
  gray: NEUTRAL_TAG_CLASSES,
};

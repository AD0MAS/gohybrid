import type { tagColorEnum } from "@/db/schema";

// Type-only import — erased at compile time, so this stays safe to import
// from the client-side builder as well as server-rendered pages.
export type TagColor = (typeof tagColorEnum.enumValues)[number];

/**
 * Tailwind classes per tag_color enum value. Centralized here so the
 * builder's tag selector, the workout detail page, and the workouts list
 * all render the same tag with the same colour.
 */
export const TAG_COLOR_CLASSES: Record<TagColor, string> = {
  red: "bg-red-100 text-red-700 border-red-300",
  orange: "bg-orange-100 text-orange-700 border-orange-300",
  green: "bg-green-100 text-green-700 border-green-300",
  blue: "bg-blue-100 text-blue-700 border-blue-300",
  purple: "bg-purple-100 text-purple-700 border-purple-300",
  gray: "bg-gray-100 text-gray-700 border-gray-300",
};

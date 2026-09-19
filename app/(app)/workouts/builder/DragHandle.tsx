import type { DraggableAttributes } from "@dnd-kit/core";
import type { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

type SortableListeners = ReturnType<typeof useSortable>["listeners"];

type DragHandleProps = {
  label: string;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: SortableListeners;
};

/**
 * The only place a block or item can be picked up. It is the sortable's
 * activator node, so the sensors listen here and nowhere else on the card;
 * `touch-none` stops the browser scrolling from a touch that starts on it
 * (scrolling from anywhere else on a card is unaffected), and `select-none`
 * plus `-webkit-touch-callout` keep a press on it from starting a text
 * selection or the iOS callout.
 * Not a "use client" file — it is only rendered from BlockEditor/ItemEditor,
 * already inside WorkoutBuilder's client boundary.
 */
export default function DragHandle({
  label,
  setActivatorNodeRef,
  attributes,
  listeners,
}: DragHandleProps) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={label}
      {...attributes}
      {...listeners}
      className="flex h-8 w-6 shrink-0 cursor-grab touch-none select-none items-center [-webkit-touch-callout:none] justify-center rounded-small text-hairline-tertiary hover:text-ink-subtle active:cursor-grabbing active:text-ink-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus"
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

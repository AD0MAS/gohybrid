import {
  closestCenter,
  type CollisionDetection,
  type Modifier,
} from "@dnd-kit/core";

/** What each sortable in the builder attaches as its dnd-kit `data`, so a
 * drag can tell a block from an item and an item's own block from another. */
export type BuilderSortableData =
  | { type: "block" }
  | { type: "item"; blockId: string };

/** Keeps a drag on the vertical axis. Written here rather than pulled from
 * @dnd-kit/modifiers, which is deliberately not a dependency. */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

const scrollBaselines = new WeakMap<Event, number>();

function totalScrollTop(ancestors: readonly Element[]): number {
  return ancestors.reduce((sum, element) => sum + element.scrollTop, 0);
}

/**
 * Keeps a dragged card inside the element it sits in — the blocks list for a
 * block, the item list of its own block for an item — the way dnd-kit's
 * restrictToParentElement does, but scroll-aware. Written here rather than
 * pulled from @dnd-kit/modifiers, which is deliberately not a dependency.
 *
 * dnd-kit measures the dragged node and its parent once, at drag start, and
 * adds the scroll delta to the translate *after* modifiers run. Bounds set
 * from the start rects alone would therefore be exceeded by however far the
 * page auto-scrolls, and the card would leave its list — growing the page,
 * which auto-scroll then chases further. So the bounds here move by the
 * scroll delta since the drag began (recorded on the first call for each
 * drag, keyed by its activator event). With the card confined to its list,
 * the document never gets taller than its content and auto-scroll stops at
 * the end of the page.
 */
export const restrictToParentElement: Modifier = ({
  activatorEvent,
  active,
  containerNodeRect,
  draggingNodeRect,
  scrollableAncestors,
  transform,
}) => {
  if (!active || !containerNodeRect || !draggingNodeRect) return transform;

  let scrollDelta = 0;
  if (activatorEvent && scrollableAncestors.length > 0) {
    const scrollNow = totalScrollTop(scrollableAncestors);
    const scrollAtStart = scrollBaselines.get(activatorEvent);
    if (scrollAtStart === undefined) {
      scrollBaselines.set(activatorEvent, scrollNow);
    } else {
      scrollDelta = scrollNow - scrollAtStart;
    }
  }

  const minY = containerNodeRect.top - draggingNodeRect.top - scrollDelta;
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom - scrollDelta;

  return {
    ...transform,
    y: Math.min(Math.max(transform.y, minY), Math.max(minY, maxY)),
  };
};

/**
 * closestCenter, but only among droppables of the same kind as the dragged
 * one — blocks against blocks, and an item only against the items of its own
 * block — so an item can never be dropped into another block, or onto a
 * block card. The drop handler re-checks the same rule.
 */
export const sameGroupCollisionDetection: CollisionDetection = (args) => {
  const active = args.active.data.current as BuilderSortableData | undefined;
  if (!active) return closestCenter(args);

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => {
      const data = container.data.current as BuilderSortableData | undefined;
      if (!data || data.type !== active.type) return false;
      return (
        active.type !== "item" ||
        (data.type === "item" && data.blockId === active.blockId)
      );
    }),
  });
};

/** Whether dropping `active` on `over` is a legal reorder, and of what. */
export function resolveReorder(
  active: BuilderSortableData | undefined,
  over: BuilderSortableData | undefined
): { kind: "block" } | { kind: "item"; blockId: string } | null {
  if (!active || !over || active.type !== over.type) return null;
  if (active.type === "block") return { kind: "block" };
  if (over.type === "item" && over.blockId === active.blockId) {
    return { kind: "item", blockId: active.blockId };
  }
  return null;
}

"use client";

import { useOptimistic } from "react";

type FavoriteToggleProps = {
  isFavorite: boolean;
  toggleFavoriteAction: () => Promise<void>;
};

/**
 * Favorite star toggle, used on both the /workouts list and the detail
 * page. The workout id is already baked into `toggleFavoriteAction` via
 * .bind(null, id) on the server-rendered page, so this component never
 * needs to know it — keeping the client boundary limited to the optimistic
 * toggle itself. useOptimistic flips the displayed state immediately on
 * click; if the action fails, the surrounding form transition settles
 * without the underlying `isFavorite` prop ever changing (revalidatePath
 * is never reached), so the optimistic value reverts to it automatically.
 */
export default function FavoriteToggle({
  isFavorite,
  toggleFavoriteAction,
}: FavoriteToggleProps) {
  const [optimisticFavorite, setOptimisticFavorite] =
    useOptimistic(isFavorite);

  async function formAction() {
    setOptimisticFavorite(!optimisticFavorite);
    try {
      await toggleFavoriteAction();
    } catch {
      // The workout was deleted or is no longer owned by this user
      // between page load and this click. Nothing to do here —
      // useOptimistic reverts the star once this transition settles,
      // since isFavorite was never updated.
    }
  }

  return (
    <form action={formAction}>
      <button
        type="submit"
        aria-label={
          optimisticFavorite ? "Remove from favorites" : "Add to favorites"
        }
        aria-pressed={optimisticFavorite}
        className="flex h-11 w-11 items-center justify-center text-lg leading-none"
      >
        {optimisticFavorite ? "★" : "☆"}
      </button>
    </form>
  );
}

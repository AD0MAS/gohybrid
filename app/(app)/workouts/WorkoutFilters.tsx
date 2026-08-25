"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { CatalogTag, Difficulty, PrimaryType } from "./builder/reducer";
import { TAG_COLOR_CLASSES } from "./tag-colors";

type WorkoutFiltersProps = {
  q: string;
  primaryType: PrimaryType | "";
  difficulty: Difficulty | "";
  favoritesOnly: boolean;
  tagIds: string[];
  primaryTypeOptions: readonly PrimaryType[];
  difficultyOptions: readonly Difficulty[];
  tagCatalog: readonly CatalogTag[];
};

const QUERY_DEBOUNCE_MS = 400;

type FilterOverrides = Partial<{
  q: string;
  primaryType: PrimaryType | "";
  difficulty: Difficulty | "";
  favoritesOnly: boolean;
  tagIds: string[];
}>;

/**
 * Filter controls for the /workouts list: title search, primary type and
 * difficulty selects, toggleable tag chips, and a favorites toggle.
 * Everything here reflects the current filters via URL search params
 * (passed down as props from the Server Component page, which is the
 * source of truth) rather than local component state — so the filtered
 * view stays reloadable and shareable, and the actual filtering logic
 * lives in lib/workouts.ts, not here. The only local state is the text
 * input's in-progress value, debounced before it becomes a navigation.
 */
export default function WorkoutFilters({
  q,
  primaryType,
  difficulty,
  favoritesOnly,
  tagIds,
  primaryTypeOptions,
  difficultyOptions,
  tagCatalog,
}: WorkoutFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [qInput, setQInput] = useState(q);

  // Resets the input when q changes from outside typing (Clear filters,
  // browser back/forward) — adjusted during render, per React's guidance
  // for syncing state to a prop change, rather than in an Effect (an
  // Effect here would set state synchronously and trigger an extra render).
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setQInput(q);
  }

  useEffect(() => {
    if (qInput === q) {
      return;
    }
    const timeout = setTimeout(() => {
      navigate({ q: qInput.trim() });
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // Only re-run when the in-progress input value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  function navigate(overrides: FilterOverrides) {
    const next = {
      q: overrides.q ?? q,
      primaryType: overrides.primaryType ?? primaryType,
      difficulty: overrides.difficulty ?? difficulty,
      favoritesOnly: overrides.favoritesOnly ?? favoritesOnly,
      tagIds: overrides.tagIds ?? tagIds,
    };

    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.primaryType) params.set("primaryType", next.primaryType);
    if (next.difficulty) params.set("difficulty", next.difficulty);
    if (next.favoritesOnly) params.set("favorites", "true");
    if (next.tagIds.length > 0) params.set("tags", next.tagIds.join(","));

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/workouts?${query}` : "/workouts");
    });
  }

  function toggleTag(tagId: string) {
    const next = tagIds.includes(tagId)
      ? tagIds.filter((id) => id !== tagId)
      : [...tagIds, tagId];
    navigate({ tagIds: next });
  }

  function clearFilters() {
    setQInput("");
    startTransition(() => {
      router.push("/workouts");
    });
  }

  const hasActiveFilters =
    q !== "" ||
    primaryType !== "" ||
    difficulty !== "" ||
    favoritesOnly ||
    tagIds.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={qInput}
          onChange={(event) => setQInput(event.target.value)}
          placeholder="Search by title"
          className="rounded border border-gray-300 p-2 text-sm"
        />

        <select
          value={primaryType}
          onChange={(event) =>
            navigate({ primaryType: event.target.value as PrimaryType | "" })
          }
          className="rounded border border-gray-300 p-2 text-sm"
        >
          <option value="">All types</option>
          {primaryTypeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(event) =>
            navigate({ difficulty: event.target.value as Difficulty | "" })
          }
          className="rounded border border-gray-300 p-2 text-sm"
        >
          <option value="">All difficulties</option>
          {difficultyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => navigate({ favoritesOnly: !favoritesOnly })}
          aria-pressed={favoritesOnly}
          className={`rounded border px-2 py-1 text-sm ${
            favoritesOnly
              ? "border-black bg-black text-white"
              : "border-gray-300"
          }`}
        >
          ★ Favorites
        </button>

        {isPending && (
          <span className="text-xs text-gray-500">Updating…</span>
        )}

        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-sm underline">
            Clear filters
          </button>
        )}
      </div>

      {tagCatalog.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tagCatalog.map((tag) => {
            const active = tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                aria-pressed={active}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  TAG_COLOR_CLASSES[tag.color]
                } ${active ? "ring-2 ring-offset-1" : "opacity-60"}`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

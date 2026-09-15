"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  key: string;
  label: string;
  content: ReactNode;
};

type BodyMetricTypeTabsProps = {
  tabs: Tab[];
};

/**
 * Toggles which metric type's reading list is visible — client state only,
 * same "which one am I looking at is a glance, not a view worth a
 * navigation" reasoning ProgressChart's own series selector uses (§7 Layer
 * 4). BodyMetricsList (a Server Component) still does every query and
 * renders every tab's actual rows; this component only decides which one's
 * wrapper loses `hidden`, so no metric data — and no client-side fetching —
 * ever needs to move to the browser. Each tab's content stays mounted at
 * all times (hidden via the `hidden` attribute rather than conditionally
 * rendered) so switching tabs is instant and costs nothing beyond a class
 * toggle.
 */
export default function BodyMetricTypeTabs({ tabs }: BodyMetricTypeTabsProps) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            aria-pressed={active === tab.key}
            className={`rounded-control border px-4 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-focus ${
              active === tab.key
                ? "border-hairline-strong bg-surface-3 text-ink"
                : "border-hairline bg-surface-2 text-ink-subtle hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} hidden={active !== tab.key}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}

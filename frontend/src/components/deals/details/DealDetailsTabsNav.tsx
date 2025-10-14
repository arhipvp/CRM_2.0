"use client";

import type { DealDetailsTabKey } from "@/stores/uiStore";

export interface DealDetailsTabsNavProps {
  tabs: Array<{ id: DealDetailsTabKey; label: string; badge?: number | string }>;
  activeTab: DealDetailsTabKey;
  onTabChange: (tab: DealDetailsTabKey) => void;
}

export function DealDetailsTabsNav({ tabs, activeTab, onTabChange }: DealDetailsTabsNavProps) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              isActive
                ? "border-sky-600 bg-sky-600 text-white shadow"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge ? (
              <span
                className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs ${
                  isActive ? "bg-white/20" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

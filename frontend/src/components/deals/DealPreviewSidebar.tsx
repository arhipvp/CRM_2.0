"use client";

import { useMemo } from "react";

import { DealDetails } from "@/components/deals/DealDetails";
import { useDeals } from "@/lib/api/hooks";
import { useUiStore } from "@/stores/uiStore";

function formatManagersList(managers: string[]) {
  const unique = Array.from(new Set(managers));
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}

export function DealPreviewSidebar() {
  const previewDealId = useUiStore((state) => state.previewDealId);
  const openDealPreview = useUiStore((state) => state.openDealPreview);
  const filters = useUiStore((state) => state.filters);
  const dealsQuery = useDeals(filters);

  const managers = useMemo(() => {
    return formatManagersList((dealsQuery.data ?? []).map((deal) => deal.owner));
  }, [dealsQuery.data]);

  if (!previewDealId) {
    return null;
  }

  return (
    <aside
      className="w-full max-w-sm flex-shrink-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
      aria-label="Быстрый просмотр сделки"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-700/60">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Быстрый просмотр</h2>
          {managers.length > 0 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              Команда: {managers.join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => openDealPreview(undefined)}
          className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:text-slate-300"
        >
          Закрыть
        </button>
      </div>
      <DealDetails dealId={previewDealId} />
    </aside>
  );
}

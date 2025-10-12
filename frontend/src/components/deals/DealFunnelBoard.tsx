"use client";

import { useMemo } from "react";
import { Deal } from "@/types/crm";
import { useDeals } from "@/lib/api/hooks";
import { PipelineStageKey, useUiStore } from "@/stores/uiStore";
import { DealCard } from "@/components/deals/DealCard";

const stageConfig: Record<PipelineStageKey, { title: string; description: string }> = {
  qualification: { title: "Квалификация", description: "Лиды, с которыми подтверждаем потребность" },
  negotiation: { title: "Переговоры", description: "Обсуждаем условия и готовим предложения" },
  proposal: { title: "Коммерческое предложение", description: "Клиент изучает финальное КП" },
  closedWon: { title: "Успешно", description: "Сделки закрыты и оплачены" },
  closedLost: { title: "Потеряно", description: "Сделки, требующие ретроспективы" },
};

const stageOrder: PipelineStageKey[] = ["qualification", "negotiation", "proposal", "closedWon", "closedLost"];

function groupByStage(deals: Deal[]) {
  return deals.reduce<Record<string, Deal[]>>((acc, deal) => {
    const stage = acc[deal.stage] ?? [];
    stage.push(deal);
    acc[deal.stage] = stage;
    return acc;
  }, {});
}

export function DealFunnelBoard() {
  const { data: deals = [], isLoading } = useDeals();
  const selectedStage = useUiStore((state) => state.selectedStage);
  const highlightedDealId = useUiStore((state) => state.highlightedDealId);
  const setSelectedStage = useUiStore((state) => state.setSelectedStage);

  const grouped = useMemo(() => groupByStage(deals), [deals]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {stageOrder.map((stage) => (
          <div key={stage} className="rounded-lg border border-slate-200 bg-white/40 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-3 h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {stageOrder.map((stage) => {
        const meta = stageConfig[stage];
        const dealsForStage = grouped[stage] ?? [];
        const isFiltered = selectedStage !== "all";
        const isSelected = selectedStage === stage;

        return (
          <section
            key={stage}
            className={`flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/80 ${
              isFiltered ? (isSelected ? "ring-2 ring-sky-300" : "opacity-60") : ""
            }`}
          >
            <header className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{meta.title}</h3>
                <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {dealsForStage.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
              <button
                type="button"
                onClick={() => setSelectedStage(selectedStage === stage ? "all" : stage)}
                className="text-xs font-medium text-sky-600 transition hover:text-sky-500 dark:text-sky-300"
              >
                {selectedStage === stage ? "Сбросить фильтр" : "Фильтровать стадию"}
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-2">
              {dealsForStage.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Нет сделок на этой стадии</p>
              ) : (
                dealsForStage.map((deal) => (
                  <DealCard key={deal.id} deal={deal} highlighted={highlightedDealId === deal.id} />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

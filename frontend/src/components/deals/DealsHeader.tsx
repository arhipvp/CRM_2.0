"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useDeals } from "@/lib/api/hooks";
import { dealsQueryOptions } from "@/lib/api/queries";
import { DEAL_STAGE_TITLES } from "@/lib/utils/deals";
import { collectManagerValues, getManagerLabel } from "@/lib/utils/managers";
import type { DealPeriodFilter } from "@/types/crm";
import { PipelineStageKey, useUiStore } from "@/stores/uiStore";

const stageOptions: Array<{ value: PipelineStageKey | "all"; label: string }> = [
  { value: "all", label: "Все" },
  { value: "qualification", label: DEAL_STAGE_TITLES.qualification },
  { value: "negotiation", label: DEAL_STAGE_TITLES.negotiation },
  { value: "proposal", label: DEAL_STAGE_TITLES.proposal },
  { value: "closedWon", label: DEAL_STAGE_TITLES.closedWon },
  { value: "closedLost", label: DEAL_STAGE_TITLES.closedLost },
];

const periodOptions: Array<{ value: DealPeriodFilter; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "all", label: "За всё время" },
];

export function DealsHeader() {
  const filters = useUiStore((state) => state.filters);
  const setSelectedStage = useUiStore((state) => state.setSelectedStage);
  const setPeriodFilter = useUiStore((state) => state.setPeriodFilter);
  const setSearchFilter = useUiStore((state) => state.setSearchFilter);
  const toggleManagerFilter = useUiStore((state) => state.toggleManagerFilter);
  const setManagersFilter = useUiStore((state) => state.setManagersFilter);
  const clearFilters = useUiStore((state) => state.clearFilters);

  const dealsQuery = useDeals(filters);
  const managerFilters = useMemo(
    () => ({
      stage: filters.stage,
      period: filters.period,
      search: filters.search,
      managers: [] as string[],
    }),
    [filters.period, filters.search, filters.stage],
  );
  const rawDealsQuery = useQuery(dealsQueryOptions(managerFilters));
  const { data: deals = [], isFetching } = dealsQuery;
  const { data: rawDeals = [] } = rawDealsQuery;

  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);

  const availableManagers = useMemo(() => {
    return collectManagerValues([
      ...rawDeals.map((deal) => deal.owner),
      ...deals.map((deal) => deal.owner),
      ...filters.managers,
    ]);
  }, [deals, filters.managers, rawDeals]);

  const totalDeals = deals.length;

  return (
    <header className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Сделки</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Управляйте базой сделок в одном месте: фильтруйте, просматривайте детали и отслеживайте ближайшие действия.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">{totalDeals}</span>
          <span className="uppercase tracking-wide">сделок в списке</span>
          {isFetching && <span className="text-xs text-slate-400">Обновление…</span>}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {stageOptions.map((option) => {
            const isActive = filters.stage === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedStage(option.value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:focus-visible:ring-sky-500 ${
                  isActive
                    ? "border-sky-500 bg-sky-100 text-sky-700 dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-200"
                    : "border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-200"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-200">
            Период
            <select
              value={filters.period}
              onChange={(event) => setPeriodFilter(event.target.value as DealPeriodFilter)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="relative" tabIndex={-1} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setManagerDropdownOpen(false);
            }
          }}>
            <button
              type="button"
              onClick={() => setManagerDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            >
              Менеджеры
              {filters.managers.length > 0 && (
                <span className="rounded-full bg-sky-100 px-2 text-xs font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                  {filters.managers.length}
                </span>
              )}
            </button>
            {managerDropdownOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900/90">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                  <span>Выберите менеджеров</span>
                  <button
                    type="button"
                    onClick={() => setManagersFilter([])}
                    className="text-xs font-medium text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    Сбросить
                  </button>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600 dark:text-slate-200">
                  {availableManagers.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">Пока нет данных</p>
                  )}
                  {availableManagers.map((manager) => {
                    const checked = filters.managers.includes(manager);
                    const label = getManagerLabel(manager);
                    return (
                      <label key={manager} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          checked={checked}
                          onChange={() => toggleManagerFilter(manager)}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setManagerDropdownOpen(false)}
                    className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-500"
                  >
                    Готово
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full items-center gap-3 lg:max-w-lg">
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Поиск по названию сделки или клиенту"
            className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
          />
        </div>
        <button
          type="button"
          onClick={() => clearFilters()}
          className="self-start rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-200"
        >
          Сбросить фильтры
        </button>
      </div>
    </header>
  );
}

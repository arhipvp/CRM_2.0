"use client";

import { useMemo, useState } from "react";

import { useDeals } from "@/lib/api/hooks";
import { collectManagerValues, getManagerLabel } from "@/lib/utils/managers";
import { useUiStore } from "@/stores/uiStore";
import type { DealPeriodFilter } from "@/types/crm";
import type { DealFiltersState } from "@/lib/utils/dealFilters";

const stageOptions: Array<{ value: DealFiltersState["stage"]; label: string }> = [
  { value: "all", label: "Все стадии" },
  { value: "qualification", label: "Квалификация" },
  { value: "negotiation", label: "Переговоры" },
  { value: "proposal", label: "Коммерческое предложение" },
  { value: "closedWon", label: "Успешно" },
  { value: "closedLost", label: "Потеряно" },
];

const periodOptions: Array<{ value: DealPeriodFilter; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "all", label: "Весь период" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DealsFiltersPanel() {
  const filters = useUiStore((state) => state.filters);
  const setSelectedStage = useUiStore((state) => state.setSelectedStage);
  const toggleManagerFilter = useUiStore((state) => state.toggleManagerFilter);
  const setManagersFilter = useUiStore((state) => state.setManagersFilter);
  const setPeriodFilter = useUiStore((state) => state.setPeriodFilter);
  const setSearchFilter = useUiStore((state) => state.setSearchFilter);
  const clearFilters = useUiStore((state) => state.clearFilters);

  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);

  const dealsQuery = useDeals(filters);
  const managerFilters = useMemo(
    () => ({
      stage: filters.stage === "all" ? undefined : filters.stage,
      period: filters.period === "all" ? undefined : filters.period,
      search: filters.search.trim().length > 0 ? filters.search : undefined,
      managers: [],
    }),
    [filters.period, filters.search, filters.stage],
  );
  const allDealsQuery = useDeals(managerFilters);

  const deals = dealsQuery.data ?? [];
  const totalDeals = deals.length;
  const totalAmount = deals.reduce((sum, deal) => sum + deal.value, 0);
  const nearestReview = useMemo(() => {
    if (deals.length === 0) {
      return undefined;
    }

    const timestamps = deals
      .map((deal) => {
        const time = new Date(deal.nextReviewAt).getTime();
        return Number.isFinite(time) ? time : undefined;
      })
      .filter((value): value is number => typeof value === "number");

    if (timestamps.length === 0) {
      return undefined;
    }

    const min = Math.min(...timestamps);
    if (!Number.isFinite(min)) {
      return undefined;
    }

    return new Date(min).toISOString();
  }, [deals]);

  const managers = useMemo(() => {
    const allDeals = allDealsQuery.data ?? [];
    return collectManagerValues([
      ...allDeals.map((deal) => deal.owner),
      ...deals.map((deal) => deal.owner),
      ...filters.managers,
    ]);
  }, [allDealsQuery.data, deals, filters.managers]);

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Сделки</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Отслеживайте приоритетные сделки в таблице: фильтры по стадии, менеджерам и периоду помогают сфокусироваться на работе с клиентами.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:auto-cols-fr lg:grid-flow-col">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Активные сделки</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{dealsQuery.isLoading ? "—" : totalDeals}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Общий объём</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {dealsQuery.isLoading ? "—" : formatCurrency(totalAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Ближайший обзор</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {dealsQuery.isLoading ? "—" : nearestReview ? formatShortDate(nearestReview) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-200">
            Стадия
            <select
              value={filters.stage}
              onChange={(event) => setSelectedStage(event.target.value as DealFiltersState["stage"])}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            >
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-200">
            Менеджеры
            <div
              className="relative"
              tabIndex={-1}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setManagerDropdownOpen(false);
                }
              }}
            >
              <button
                type="button"
                onClick={() => setManagerDropdownOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
              >
                {filters.managers.length > 0 ? `${filters.managers.length} выбрано` : "Все"}
                <span className="text-xs text-slate-400">▾</span>
              </button>
              {managerDropdownOpen && (
                <div className="absolute left-0 z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900/90">
                  <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-300">Выберите менеджеров</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm text-slate-600 dark:text-slate-200">
                    {managers.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">Пока нет данных</p>}
                    {managers.map((manager) => {
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
                  <div className="mt-3 flex justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setManagersFilter([])}
                      className="rounded border border-transparent px-2 py-1 font-medium text-slate-500 transition hover:border-slate-200 hover:text-slate-700 dark:text-slate-300"
                    >
                      Сбросить
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagerDropdownOpen(false)}
                      className="rounded bg-sky-600 px-3 py-1 font-semibold text-white transition hover:bg-sky-500"
                    >
                      Готово
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-200">
            Период
            <select
              value={filters.period}
              onChange={(event) => setPeriodFilter(event.target.value as DealPeriodFilter)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-200">
            Поиск
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Название или клиент"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => clearFilters()}
          className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-200"
        >
          Сбросить фильтры
        </button>
      </div>
    </section>
  );
}

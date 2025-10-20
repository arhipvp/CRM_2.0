"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DealCreateModal } from "@/components/deals/DealCreateModal";
import { ClientCreateModal } from "@/components/clients/ClientCreateModal";
import { useClients, useDeals, useDealStageMetrics } from "@/lib/api/hooks";
import { dealsQueryOptions } from "@/lib/api/queries";
import { createRandomId } from "@/lib/utils/id";
import { DEAL_STAGE_TITLES } from "@/lib/utils/deals";
import { NO_MANAGER_VALUE, collectManagerValues, getManagerLabel } from "@/lib/utils/managers";
import type { Client, Deal } from "@/types/crm";
import type { DealPeriodFilter, DealStageMetrics } from "@/types/crm";
import { DealViewMode, PipelineStageKey, useUiStore } from "@/stores/uiStore";

const stageLabels: Record<PipelineStageKey, string> = {
  qualification: DEAL_STAGE_TITLES.qualification,
  negotiation: DEAL_STAGE_TITLES.negotiation,
  proposal: DEAL_STAGE_TITLES.proposal,
  closedWon: DEAL_STAGE_TITLES.closedWon,
  closedLost: DEAL_STAGE_TITLES.closedLost,
};

const stageDescriptions: Record<PipelineStageKey, string> = {
  qualification: "Первая коммуникация и проверка потребности",
  negotiation: "Обсуждение условий и возражений",
  proposal: "Клиент изучает финальное предложение",
  closedWon: "Сделка успешно закрыта",
  closedLost: "Сделка не завершилась успехом",
};

const periodOptions: Array<{ value: DealPeriodFilter; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
  { value: "all", label: "Весь период" },
];

const viewOptions: Array<{ value: DealViewMode; label: string }> = [
  { value: "kanban", label: "Канбан" },
  { value: "table", label: "Таблица" },
];

const stageOrder: PipelineStageKey[] = [
  "qualification",
  "negotiation",
  "proposal",
  "closedWon",
  "closedLost",
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatConversionRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function DealFunnelHeader() {
  const filters = useUiStore((state) => state.filters);
  const viewMode = useUiStore((state) => state.viewMode);
  const setPeriodFilter = useUiStore((state) => state.setPeriodFilter);
  const setSearchFilter = useUiStore((state) => state.setSearchFilter);
  const toggleManagerFilter = useUiStore((state) => state.toggleManagerFilter);
  const setManagersFilter = useUiStore((state) => state.setManagersFilter);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const setSelectedStage = useUiStore((state) => state.setSelectedStage);
  const pushNotification = useUiStore((state) => state.pushNotification);

  const managerFilters = useMemo(
    () => ({
      stage: filters.stage,
      period: filters.period,
      search: filters.search,
      managers: [] as string[],
    }),
    [filters.period, filters.search, filters.stage],
  );

  const dealsQuery = useDeals(filters);
  const rawDealsQuery = useQuery(dealsQueryOptions(managerFilters));
  const metricsQuery = useDealStageMetrics(filters);
  const clientsQuery = useClients();
  const { data: deals = [] } = dealsQuery;
  const { data: rawDeals = [] } = rawDealsQuery;
  const { data: metrics = [], isLoading: metricsLoading, isError: metricsError, error: metricsErrorValue } = metricsQuery;
  const { data: clients = [] } = clientsQuery;

  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isClientModalOpen, setClientModalOpen] = useState(false);

  const managers = useMemo(() => {
    return collectManagerValues([
      ...rawDeals.map((deal) => deal.owner),
      ...deals.map((deal) => deal.owner),
      ...filters.managers,
    ]);
  }, [deals, filters.managers, rawDeals]);

  const metricsMap = useMemo(() => {
    const map = new Map<PipelineStageKey, DealStageMetrics>();
    for (const metric of metrics) {
      map.set(metric.stage as PipelineStageKey, metric);
    }
    return map;
  }, [metrics]);

  const activeStage = filters.stage;
  const defaultOwnerId = useMemo(() => {
    if (filters.managers.length !== 1) {
      return undefined;
    }

    const [manager] = filters.managers;
    if (manager === NO_MANAGER_VALUE) {
      return undefined;
    }

    return manager;
  }, [filters.managers]);

  const handleDealCreated = useCallback(
    (deal: Deal) => {
      pushNotification({
        id: `notification-${createRandomId()}`,
        message: `Сделка «${deal.name}» создана`,
        type: "success",
        timestamp: new Date().toISOString(),
        source: "crm",
      });
    },
    [pushNotification],
  );

  const handleCreateClient = useCallback(() => {
    setClientModalOpen(true);
  }, []);

  const handleClientCreated = useCallback(
    (client: Client) => {
      pushNotification({
        id: `notification-${createRandomId()}`,
        message: `Клиент «${client.name}» создан`,
        type: "success",
        timestamp: new Date().toISOString(),
        source: "crm",
      });
    },
    [pushNotification],
  );

  return (
    <>
      <header className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Воронка сделок</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Управляйте стадиями, отслеживайте конверсию и реагируйте на риски в реальном времени.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
              <div className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900/90">
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

          <input
            type="search"
            value={filters.search}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Поиск по сделкам"
            className="w-full min-w-[220px] flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
          />

          <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            {viewOptions.map((option) => {
              const isActive = viewMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  className={classNames(
                    "rounded px-3 py-1 font-medium transition",
                    isActive
                      ? "bg-sky-600 text-white shadow-sm"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            Новая сделка
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
          <span>Статус по стадиям</span>
          {metricsLoading && <span>Загрузка метрик…</span>}
          {metricsError && (
            <span className="text-rose-500">
              {metricsErrorValue instanceof Error ? metricsErrorValue.message : "Не удалось получить метрики"}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {stageOrder.map((stage) => {
            const metric = metricsMap.get(stage);
            const count = metric?.count ?? 0;
            const conversion = metric ? formatConversionRate(metric.conversionRate) : "—";
            const duration = metric?.avgCycleDurationDays ?? null;
            const isActive = activeStage === stage;

            if (metricsLoading) {
              return (
                <div
                  key={stage}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <div className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              );
            }

            return (
              <button
                key={stage}
                type="button"
                onClick={() => setSelectedStage(isActive ? "all" : stage)}
                className={classNames(
                  "flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70",
                  isActive && "ring-2 ring-sky-400 dark:ring-sky-500",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{stageLabels[stage]}</span>
                  <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    {count}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{stageDescriptions[stage]}</p>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-300" title="Конверсия">
                  Конверсия: {conversion}
                </div>
                {duration !== null && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Средний цикл: {duration.toFixed(1)} дн.</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
      </header>
      <DealCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        clients={clients}
        owners={managers}
        defaultOwnerId={defaultOwnerId}
        onDealCreated={handleDealCreated}
        onCreateClient={handleCreateClient}
      />
      <ClientCreateModal
        isOpen={isClientModalOpen}
        onClose={() => setClientModalOpen(false)}
        owners={managers}
        defaultOwnerId={defaultOwnerId}
        onClientCreated={(client) => {
          handleClientCreated(client);
          setClientModalOpen(false);
        }}
      />
    </>
  );
}

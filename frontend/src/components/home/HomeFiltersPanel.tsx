"use client";

import { useMemo, type ChangeEvent } from "react";

import type { HomeComparisonMode, HomeFunnelKey } from "@/components/home/types";
import type { DealFiltersState } from "@/lib/utils/dealFilters";
import { NO_MANAGER_LABEL, NO_MANAGER_VALUE, getManagerLabel } from "@/lib/utils/managers";

interface HomeFiltersPanelProps {
  filters: DealFiltersState;
  onFiltersChange: (filters: DealFiltersState) => void;
  selectedFunnel: HomeFunnelKey;
  onFunnelChange: (funnel: HomeFunnelKey) => void;
  comparisonMode: HomeComparisonMode;
  onComparisonModeChange: (mode: HomeComparisonMode) => void;
}

const stageLabels: Record<DealFiltersState["stage"], string> = {
  all: "Все этапы",
  qualification: "Квалификация",
  negotiation: "Переговоры",
  proposal: "Предложение",
  closedWon: "Успешные",
  closedLost: "Проваленные",
};

const periodLabels: Record<DealFiltersState["period"], string> = {
  "7d": "7 дней",
  "30d": "30 дней",
  "90d": "90 дней",
  all: "За всё время",
};

const funnelOptions: Array<{ value: HomeFunnelKey; label: string; description: string }> = [
  { value: "main", label: "Основная воронка", description: "Вся активная загрузка менеджеров" },
  { value: "renewals", label: "Продления", description: "Работа с повторными продажами и продлениями" },
  { value: "partners", label: "Партнёрский канал", description: "Сделки из рефералов и агентов" },
];

const comparisonLabels: Record<HomeComparisonMode, string> = {
  previousPeriod: "С прошлым периодом",
  previousYear: "С прошлым годом",
  plan: "С планом",
};

const availableManagers = ["Анна Смирнова", "Игорь Петров", "Светлана Кузнецова", NO_MANAGER_VALUE] as const;

export function HomeFiltersPanel({
  filters,
  onFiltersChange,
  selectedFunnel,
  onFunnelChange,
  comparisonMode,
  onComparisonModeChange,
}: HomeFiltersPanelProps) {
  const activeStageLabel = stageLabels[filters.stage];
  const activePeriodLabel = periodLabels[filters.period];
  const activeFunnel = useMemo(() => funnelOptions.find((option) => option.value === selectedFunnel), [selectedFunnel]);

  const handleStageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      stage: event.target.value as DealFiltersState["stage"],
    });
  };

  const handlePeriodChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      period: event.target.value as DealFiltersState["period"],
    });
  };

  const toggleManager = (manager: string) => {
    const hasManager = filters.managers.includes(manager);
    const managers = hasManager
      ? filters.managers.filter((value) => value !== manager)
      : [...filters.managers, manager];

    onFiltersChange({
      ...filters,
      managers,
    });
  };

  const handleFunnelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onFunnelChange(event.target.value as HomeFunnelKey);
  };

  const handleComparisonChange = (mode: HomeComparisonMode) => {
    onComparisonModeChange(mode);
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-600">Главный экран</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Выбор показателей в CRM</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Настройте набор метрик, который попадёт в итоговую сводку. Фильтры применяются сразу ко всем графикам и таблицам.
        </p>
      </header>

      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="home-stage-filter">
            Категория показателей
          </label>
          <select
            id="home-stage-filter"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={filters.stage}
            onChange={handleStageChange}
          >
            {Object.entries(stageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="home-funnel-filter">
            Воронка
          </label>
          <select
            id="home-funnel-filter"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={selectedFunnel}
            onChange={handleFunnelChange}
          >
            {funnelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {activeFunnel && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{activeFunnel.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="home-period-filter">
            Период анализа
          </label>
          <select
            id="home-period-filter"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            value={filters.period}
            onChange={handlePeriodChange}
          >
            {Object.entries(periodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Ответственные</p>
          <div className="flex flex-wrap gap-2">
            {availableManagers.map((manager) => {
              const checked = filters.managers.includes(manager);
              const label = manager === NO_MANAGER_VALUE ? NO_MANAGER_LABEL : getManagerLabel(manager);

              return (
                <button
                  key={manager}
                  type="button"
                  onClick={() => toggleManager(manager)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:focus-visible:ring-sky-500 ${
                    checked
                      ? "border-sky-500 bg-sky-100 text-sky-700 dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-200"
                      : "border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Сравнение</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(comparisonLabels) as Array<HomeComparisonMode>).map((mode) => {
              const isActive = comparisonMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleComparisonChange(mode)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:focus-visible:ring-sky-500 ${
                    isActive
                      ? "border-sky-500 bg-sky-100 text-sky-700 dark:border-sky-400 dark:bg-sky-500/20 dark:text-sky-200"
                      : "border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-200"
                  }`}
                >
                  {comparisonLabels[mode]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <dl className="mt-8 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Категория</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{activeStageLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Воронка</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{activeFunnel?.label ?? "—"}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Период</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{activePeriodLabel}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ответственные</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">
            {filters.managers.length > 0
              ? filters.managers.map((manager) => (manager === NO_MANAGER_VALUE ? NO_MANAGER_LABEL : getManagerLabel(manager))).join(", ")
              : "Все"}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Сравнение</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{comparisonLabels[comparisonMode]}</dd>
        </div>
      </dl>
    </article>
  );
}

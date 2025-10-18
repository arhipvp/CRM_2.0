"use client";

import { useMemo } from "react";

import { StageMetricsChart } from "@/components/home/StageMetricsChart";
import type { HomeComparisonMode, HomeFunnelKey } from "@/components/home/types";
import { useDealStageMetrics } from "@/lib/api/hooks";
import type { DealFiltersState } from "@/lib/utils/dealFilters";
import type { DealStageMetrics } from "@/types/crm";

interface HomeStageMetricsPanelProps {
  filters: DealFiltersState;
  selectedFunnel: HomeFunnelKey;
  comparisonMode: HomeComparisonMode;
}

const stageLabels: Record<DealStageMetrics["stage"], string> = {
  qualification: "Квалификация",
  negotiation: "Переговоры",
  proposal: "Предложение",
  closedWon: "Успешные",
  closedLost: "Проваленные",
};

const comparisonLabels: Record<HomeComparisonMode, string> = {
  previousPeriod: "С прошлым периодом",
  previousYear: "С прошлым годом",
  plan: "С планом",
};

const funnelLabels: Record<HomeFunnelKey, string> = {
  main: "Основная воронка",
  renewals: "Продления",
  partners: "Партнёрский канал",
};

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const durationFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export function HomeStageMetricsPanel({ filters, selectedFunnel, comparisonMode }: HomeStageMetricsPanelProps) {
  const metricsQuery = useDealStageMetrics(filters);

  const totals = useMemo(() => {
    if (!metricsQuery.data || metricsQuery.data.length === 0) {
      return { count: 0, totalValue: 0 };
    }

    return metricsQuery.data.reduce(
      (acc, metric) => {
        acc.count += metric.count;
        acc.totalValue += metric.totalValue;
        return acc;
      },
      { count: 0, totalValue: 0 },
    );
  }, [metricsQuery.data]);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-sky-600">Аналитика</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Количество сделок по этапам</h2>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <p>{funnelLabels[selectedFunnel]}</p>
          <p>{comparisonLabels[comparisonMode]}</p>
        </div>
      </header>

      <section className="mt-6 grow">
        {metricsQuery.isLoading ? (
          <div className="flex h-full flex-col justify-center gap-4">
            <div className="h-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        ) : metricsQuery.isError ? (
          <div className="flex h-full flex-col items-start justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
            <p className="font-medium">Не удалось загрузить метрики воронки</p>
            <p className="text-xs opacity-80">Попробуйте обновить страницу или выбрать другой набор фильтров.</p>
          </div>
        ) : metricsQuery.data && metricsQuery.data.length > 0 ? (
          <div className="flex h-full flex-col gap-6">
            <StageMetricsChart metrics={metricsQuery.data} />

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="py-2 pr-4 font-medium">Этап</th>
                    <th className="py-2 pr-4 font-medium">Количество</th>
                    <th className="py-2 pr-4 font-medium">Сумма</th>
                    <th className="py-2 pr-4 font-medium">Средний цикл</th>
                    <th className="py-2 font-medium">Конверсия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metricsQuery.data.map((metric) => (
                    <tr key={metric.stage} className="text-slate-700 dark:text-slate-200">
                      <td className="py-2 pr-4 font-medium">{stageLabels[metric.stage]}</td>
                      <td className="py-2 pr-4">{metric.count}</td>
                      <td className="py-2 pr-4">{currencyFormatter.format(metric.totalValue)}</td>
                      <td className="py-2 pr-4">
                        {metric.avgCycleDurationDays !== null
                          ? `${durationFormatter.format(metric.avgCycleDurationDays)} дн.`
                          : "—"}
                      </td>
                      <td className="py-2">{`${Math.round(metric.conversionRate * 100)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-200">Нет данных для выбранных фильтров</p>
            <p className="text-xs">Сделайте новый выбор или сбросьте фильтры, чтобы увидеть динамику по воронке.</p>
          </div>
        )}
      </section>

      <footer className="mt-6 flex flex-wrap gap-6 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Всего сделок</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{totals.count}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Суммарный объём</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{currencyFormatter.format(totals.totalValue)}</p>
        </div>
      </footer>
    </article>
  );
}

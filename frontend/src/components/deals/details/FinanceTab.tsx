"use client";

import type { DealFinanceSummary } from "@/types/crm";

interface FinanceTabProps {
  summary: DealFinanceSummary;
  onExport?: () => void;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function FinanceTab({ summary, onExport }: FinanceTabProps) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Финансовые показатели</h3>
          <p className="text-xs text-slate-500">Последнее обновление: {formatDate(summary.lastUpdated)}</p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={!summary.exportAvailable}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
            summary.exportAvailable
              ? "border-sky-200 text-sky-600 hover:border-sky-300"
              : "border-slate-200 text-slate-400"
          }`}
          title={summary.exportAvailable ? undefined : summary.exportDisabledReason}
        >
          Экспортировать отчёт
        </button>
      </header>
      <dl className="grid gap-4 md:grid-cols-3">
        {summary.metrics.map((metric) => (
          <div key={metric.id} className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</dt>
            <dd className="text-xl font-semibold text-slate-900 dark:text-white">
              {formatCurrency(metric.amount, metric.currency)}
            </dd>
            {typeof metric.delta === "number" ? (
              <p className={`text-xs font-medium ${metric.delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {metric.delta >= 0 ? "+" : ""}
                {metric.delta.toFixed(1)}%
              </p>
            ) : null}
            {metric.linkToPayments ? (
              <button type="button" className="text-xs font-medium text-sky-600">
                Перейти к платежам
              </button>
            ) : null}
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500">
        Суммы рассчитываются по подтверждённым и ожидающим подтверждения платежам. Черновые платежи и неподтверждённые расходы не учитываются.
      </p>
    </section>
  );
}

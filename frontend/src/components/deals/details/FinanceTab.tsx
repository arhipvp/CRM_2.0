"use client";

import type { DealFinanceSummary, Deal } from "@/types/crm";
import { PaymentStatusIndicator } from "@/components/payments/PaymentStatusIndicator";

interface FinanceTabProps {
  summary: DealFinanceSummary;
  deal?: Deal;
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

export function FinanceTab({ summary, deal, onExport }: FinanceTabProps) {
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

      {deal && deal.payments && deal.payments.length > 0 ? (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Платежи</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Полис</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Статус</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Плановая сумма</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Фактическая</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Подтверждение</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Ход выполнения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {deal.payments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">
                      {payment.policyNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(payment.status)}`}>
                        {getStatusLabel(payment.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {formatCurrency(payment.plannedAmount ?? payment.amount, payment.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {payment.actualAmount ? formatCurrency(payment.actualAmount, payment.currency) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        payment.confirmationStatus === "confirmed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                      }`}>
                        {payment.confirmationStatus === "confirmed" ? "✓ Подтверждено" : "⏳ Ожидает"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusIndicator payment={payment} size="sm" showLabels={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function getStatusClass(status: string): string {
  switch (status) {
    case "planned":
      return "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200";
    case "expected":
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
    case "received":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200";
    case "paid_out":
      return "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200";
    case "cancelled":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "planned":
      return "Запланирован";
    case "expected":
      return "Ожидается";
    case "received":
      return "Получен";
    case "paid_out":
      return "Выплачен";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

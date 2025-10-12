"use client";

import { useMemo } from "react";
import { useDealPayments } from "@/lib/api/hooks";
import type { Payment } from "@/types/crm";

interface DealFinanceProps {
  dealId: string;
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function summarize(payments: Payment[]) {
  return payments.reduce(
    (acc, payment) => {
      acc.total += payment.amount;
      if (payment.status === "received" || payment.status === "paid_out") {
        acc.completed += payment.amount;
      }
      return acc;
    },
    { total: 0, completed: 0 },
  );
}

const STATUS_LABELS: Record<Payment["status"], string> = {
  planned: "Запланирован",
  expected: "Ожидается",
  received: "Получен",
  paid_out: "Выплачен",
  cancelled: "Отменён",
};

export function DealFinance({ dealId }: DealFinanceProps) {
  const { data: payments = [], isLoading } = useDealPayments(dealId);

  const totals = useMemo(() => summarize(payments), [payments]);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Финансы</h2>
          <p className="text-sm text-slate-500">Всего в работе: {formatCurrency(totals.total, payments[0]?.currency ?? "RUB")}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
          Получено: {formatCurrency(totals.completed, payments[0]?.currency ?? "RUB")}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate-500">Платежи ещё не созданы.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Платёж</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Статус</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Срок</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{payment.id}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{STATUS_LABELS[payment.status]}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(payment.dueDate)}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{formatCurrency(payment.amount, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

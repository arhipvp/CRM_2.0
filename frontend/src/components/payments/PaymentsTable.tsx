"use client";

import Link from "next/link";
import { usePayments } from "@/lib/api/hooks";
import type { PaymentStatus } from "@/types/crm";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

const statusConfig: Record<PaymentStatus, { label: string; className: string; ariaLabel: string }> = {
  planned: {
    label: "Запланирован",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
    ariaLabel: "Статус платежа: запланирован",
  },
  expected: {
    label: "Ожидается",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    ariaLabel: "Статус платежа: ожидается",
  },
  received: {
    label: "Получен",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    ariaLabel: "Статус платежа: получен",
  },
  paid_out: {
    label: "Выплачен",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    ariaLabel: "Статус платежа: выплачен",
  },
  cancelled: {
    label: "Отменён",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
    ariaLabel: "Статус платежа: отменён",
  },
};

const fallbackStatus = {
  label: "Неизвестен",
  className: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
  ariaLabel: "Статус платежа: неизвестен",
};

export function PaymentsTable() {
  const { data: payments = [], isLoading } = usePayments();

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
            <th className="px-4 py-3">Клиент</th>
            <th className="px-4 py-3">Сделка</th>
            <th className="px-4 py-3">Сумма</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Срок</th>
            <th className="px-4 py-3" aria-label="actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm text-slate-600 dark:divide-slate-800 dark:text-slate-200">
          {payments.map((payment) => (
            <tr key={payment.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-3">{payment.clientId}</td>
              <td className="px-4 py-3">
                <Link href={`/deals/${payment.dealId}`} className="text-sky-600 hover:underline">
                  {payment.dealId}
                </Link>
              </td>
              <td className="px-4 py-3 font-medium">{formatCurrency(payment.amount)}</td>
              <td className="px-4 py-3">
                {(() => {
                  const config = statusConfig[payment.status as PaymentStatus] ?? fallbackStatus;
                  return (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${config.className}`}
                      aria-label={config.ariaLabel}
                      title={config.label}
                    >
                      {config.label}
                    </span>
                  );
                })()}
              </td>
              <td className="px-4 py-3">
                {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(payment.dueDate))}
              </td>
              <td className="px-4 py-3 text-right">
                <button className="text-xs font-medium text-sky-600 hover:underline">Напомнить</button>
              </td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                Платежи не найдены.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

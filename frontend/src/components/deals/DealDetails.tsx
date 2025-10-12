"use client";

import Link from "next/link";
import { useDeal } from "@/lib/api/hooks";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DealDetails({ dealId }: { dealId: string }) {
  const { data: deal, isLoading } = useDeal(dealId);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (!deal) {
    return <p className="text-sm text-slate-500">Сделка не найдена.</p>;
  }

  return (
    <article className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{deal.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Клиент: <Link href={`/clients/${deal.clientId}`} className="text-sky-600 hover:underline">{deal.clientName}</Link>
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-200">
        <div>
          <dt className="font-medium">Сумма</dt>
          <dd>{formatCurrency(deal.value)}</dd>
        </div>
        <div>
          <dt className="font-medium">Вероятность</dt>
          <dd>{Math.round(deal.probability * 100)}%</dd>
        </div>
        <div>
          <dt className="font-medium">Стадия</dt>
          <dd>{deal.stage}</dd>
        </div>
        <div>
          <dt className="font-medium">Ответственный</dt>
          <dd>{deal.owner}</dd>
        </div>
        <div>
          <dt className="font-medium">Обновлено</dt>
          <dd>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(deal.updatedAt))}</dd>
        </div>
        {deal.expectedCloseDate && (
          <div>
            <dt className="font-medium">Ожидаемое закрытие</dt>
            <dd>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(deal.expectedCloseDate))}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

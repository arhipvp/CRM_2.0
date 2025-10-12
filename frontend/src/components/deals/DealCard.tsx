"use client";

import Link from "next/link";
import { Deal } from "@/types/crm";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

export interface DealCardProps {
  deal: Deal;
  highlighted?: boolean;
}

export function DealCard({ deal, highlighted }: DealCardProps) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 ${highlighted ? "ring-2 ring-amber-400" : ""}`}
      aria-label={`Сделка ${deal.name} для клиента ${deal.clientName} на сумму ${formatCurrency(deal.value)}`}
    >
      <div className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
        <span>{deal.name}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-100">
          {formatProbability(deal.probability)}
        </span>
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-300">{deal.clientName}</div>
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-300">
        <span>{formatCurrency(deal.value)}</span>
        {deal.expectedCloseDate && (
          <span title="Ожидаемая дата закрытия">{new Intl.DateTimeFormat("ru-RU").format(new Date(deal.expectedCloseDate))}</span>
        )}
      </div>
      <div className="text-xs text-slate-400 dark:text-slate-500">Ответственный: {deal.owner}</div>
    </Link>
  );
}

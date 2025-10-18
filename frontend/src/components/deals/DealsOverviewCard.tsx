"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useDeals } from "@/lib/api/hooks";
import { sortDealsByNextReview } from "@/lib/utils/deals";

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DealsOverviewCard() {
  const dealsQuery = useDeals();
  const deals = dealsQuery.data ?? [];
  const topDeals = useMemo(() => sortDealsByNextReview(deals).slice(0, 5), [deals]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
        <span>Обзор сделок</span>
        <Link href="/deals" className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-300">
          Все сделки
        </Link>
      </div>
      {dealsQuery.isLoading ? (
        <div className="space-y-3 px-4 py-6 text-sm text-slate-500 dark:text-slate-300">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: скелетон
              key={index}
              className="flex items-center justify-between gap-4"
            >
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : dealsQuery.isError ? (
        <div className="px-4 py-6 text-sm text-rose-600 dark:text-rose-300">
          Не удалось загрузить сделки. <Link href="/deals" className="underline">Перейти в раздел</Link>
        </div>
      ) : topDeals.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300">Пока нет активных сделок.</div>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {topDeals.map((deal) => (
            <li key={deal.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex flex-col">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{deal.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{deal.clientName}</span>
              </div>
              <div className="flex flex-col items-end text-xs text-slate-500 dark:text-slate-400">
                <span>Просмотр до</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatShortDate(deal.nextReviewAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

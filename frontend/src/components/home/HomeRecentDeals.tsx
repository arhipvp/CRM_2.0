"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useDeals } from "@/lib/api/hooks";
import { sortDealsByNextReview } from "@/lib/utils/deals";
import { getManagerLabel, NO_MANAGER_VALUE, normalizeManagerValue } from "@/lib/utils/managers";
import type { DealFiltersState } from "@/lib/utils/dealFilters";

interface HomeRecentDealsProps {
  filters: DealFiltersState;
}

export function HomeRecentDeals({ filters }: HomeRecentDealsProps) {
  const dealsQuery = useDeals(filters);
  const { data: deals = [], isLoading, isError, error, refetch } = dealsQuery;

  const upcomingDeals = useMemo(() => sortDealsByNextReview(deals).slice(0, 5), [deals]);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-sky-600">Ближайшие действия</p>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Предстоящие обзвоны и встречи</h2>
        </div>
        <Link
          href="/deals"
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
        >
          Открыть все сделки
        </Link>
      </header>

      <section className="mt-6 flex-1">
        {isLoading ? (
          <ul className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: индексы подходят для статичного скелета
                key={index}
                className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
            <div>
              <p className="font-semibold">Не удалось загрузить список сделок</p>
              <p className="text-xs opacity-80">{error instanceof Error ? error.message : String(error)}</p>
            </div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="self-start rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-500"
            >
              Повторить
            </button>
          </div>
        ) : upcomingDeals.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800/40 dark:text-slate-300">
            <p className="font-medium text-slate-700 dark:text-slate-200">Нет сделок для отображения</p>
            <p className="text-xs">Добавьте новую сделку или обновите фильтры, чтобы увидеть активные задачи.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {upcomingDeals.map((deal) => {
              const ownerLabel = getManagerLabel(normalizeManagerValue(deal.owner) ?? NO_MANAGER_VALUE);
              const nextReviewDate = deal.nextReviewAt
                ? new Intl.DateTimeFormat("ru-RU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(deal.nextReviewAt))
                : "Не назначено";

              return (
                <li
                  key={deal.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-sky-200 dark:border-slate-700 dark:hover:border-sky-500/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{deal.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{deal.clientName}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {ownerLabel}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Следующий просмотр</dt>
                      <dd className="text-sm font-medium text-slate-800 dark:text-slate-200">{nextReviewDate}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Стадия</dt>
                      <dd className="text-sm text-slate-600 dark:text-slate-300">{deal.stage}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Вероятность</dt>
                      <dd className="text-sm text-slate-600 dark:text-slate-300">{Math.round(deal.probability * 100)}%</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}

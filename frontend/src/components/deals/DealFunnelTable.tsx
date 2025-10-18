"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import type { KeyboardEvent } from "react";

import { useDeals } from "@/lib/api/hooks";
import { DealPreviewSidebar } from "@/components/deals/DealPreviewSidebar";
import { DealBulkActions } from "@/components/deals/DealBulkActions";
import { sortDealsByNextReview } from "@/lib/utils/deals";
import { createRandomId } from "@/lib/utils/id";
import { getManagerLabel, NO_MANAGER_VALUE, normalizeManagerValue } from "@/lib/utils/managers";
import { useUiStore } from "@/stores/uiStore";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const DEAL_UPDATE_HIGHLIGHT_TIMEOUT = 4_000;

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

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function getNextReviewTone(nextReviewAt: string) {
  const timestamp = new Date(nextReviewAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return {
      indicator: "bg-slate-300 dark:bg-slate-600",
      text: "text-slate-500 dark:text-slate-400",
    } as const;
  }

  const diff = timestamp - Date.now();
  const dayInMs = 86_400_000;

  if (diff < 0) {
    return {
      indicator: "bg-rose-500",
      text: "text-rose-600 dark:text-rose-300",
    } as const;
  }

  if (diff <= dayInMs * 2) {
    return {
      indicator: "bg-amber-400",
      text: "text-amber-600 dark:text-amber-300",
    } as const;
  }

  return {
    indicator: "bg-emerald-400",
    text: "text-emerald-600 dark:text-emerald-300",
  } as const;
}

export function DealFunnelTable() {
  const filters = useUiStore((state) => state.filters);
  const viewMode = useUiStore((state) => state.viewMode);
  const selectedDealIds = useUiStore((state) => state.selectedDealIds);
  const toggleDealSelection = useUiStore((state) => state.toggleDealSelection);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const clearFilters = useUiStore((state) => state.clearFilters);
  const openDealPreview = useUiStore((state) => state.openDealPreview);
  const highlightedDealId = useUiStore((state) => state.highlightedDealId);
  const pushNotification = useUiStore((state) => state.pushNotification);
  const dealUpdates = useUiStore((state) => state.dealUpdates);
  const clearDealUpdate = useUiStore((state) => state.clearDealUpdate);

  const dealsQuery = useDeals(filters);
  const { data: deals = [], isLoading, isError, error, isFetching, refetch } = dealsQuery;
  const dealsForRender = useMemo(() => sortDealsByNextReview(deals), [deals]);
  const recentlyUpdatedDealIds = useMemo(
    () => new Set(Object.keys(dealUpdates)),
    [dealUpdates],
  );

  const buildRowState = (dealId: string) => {
    const isSelected = selectedDealIds.includes(dealId);
    const isRecentlyUpdated = recentlyUpdatedDealIds.has(dealId);
    const isHighlighted = highlightedDealId === dealId;
    const rowClassName = classNames(
      "cursor-pointer bg-white transition hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-900/40",
      isSelected && "bg-sky-50/80 dark:bg-sky-500/10",
      isHighlighted && "ring-2 ring-amber-300",
      isRecentlyUpdated && "deal-update-highlight ring-2 ring-amber-400",
    );

    const handleActivate = () => {
      openDealPreview(dealId);
      if (isRecentlyUpdated) {
        clearDealUpdate(dealId);
      }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleActivate();
      }
    };

    return {
      isSelected,
      rowClassName,
      handleActivate,
      handleKeyDown,
    };
  };

  useEffect(() => {
    if (viewMode !== "table") {
      return;
    }

    const dealIds = Object.keys(dealUpdates);
    if (dealIds.length === 0) {
      return;
    }

    const timers = dealIds.map((dealId) =>
      window.setTimeout(() => {
        clearDealUpdate(dealId);
      }, DEAL_UPDATE_HIGHLIGHT_TIMEOUT),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [dealUpdates, clearDealUpdate, viewMode]);

  if (viewMode !== "table") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              Загружаем сделки…
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: индексы используются для скелетона
                  key={index}
                  className="grid grid-cols-10 gap-4 px-4 py-4"
                >
                  <div className="col-span-2 h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="col-span-1 h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DealPreviewSidebar />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-500/60 dark:bg-rose-900/20 dark:text-rose-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold">Не удалось загрузить сделки</p>
            <p className="mt-1 text-xs text-rose-800 dark:text-rose-200/80">{error instanceof Error ? error.message : String(error)}</p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-500"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  const hasDeals = dealsForRender.length > 0;
  const hasBulkSelection = selectedDealIds.length > 0;

  const handleHideBulkActions = () => {
    clearSelection();
  };

  const containerClassName = classNames(
    "flex flex-col gap-6 lg:flex-row",
    hasBulkSelection && "pb-28",
  );

  return (
    <>
      <div className={containerClassName}>
        <div className="flex-1 space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            <span>Список сделок</span>
            {isFetching && <span className="text-xs font-normal text-slate-400">Обновление…</span>}
          </div>
          {hasDeals ? (
            <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">
                    Сделка
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Клиент
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Стадия
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Вероятность
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Сумма
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Следующий просмотр
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Обновлено
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dealsForRender.map((deal) => {
                  const { isSelected, rowClassName, handleActivate, handleKeyDown } = buildRowState(deal.id);
                  const nextReviewTone = getNextReviewTone(deal.nextReviewAt);

                  return (
                    <tr
                      key={deal.id}
                      className={rowClassName}
                      onClick={handleActivate}
                      onKeyDown={handleKeyDown}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 flex-shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            checked={isSelected}
                            onChange={(event) => {
                              event.stopPropagation();
                              toggleDealSelection(deal.id);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            aria-label="Выбрать сделку"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{deal.name}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{deal.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{deal.clientName}</td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{deal.stage}</td>
                      <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-300">{formatProbability(deal.probability)}</td>
                      <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-300">{formatCurrency(deal.value)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className={classNames("flex items-center gap-2 text-xs font-medium", nextReviewTone.text)}>
                            <span
                              className={classNames("h-2 w-2 rounded-full", nextReviewTone.indicator)}
                              aria-hidden="true"
                            />
                            Следующий просмотр
                          </span>
                          <span className={classNames("text-xs font-semibold", nextReviewTone.text)}>
                            {formatShortDate(deal.nextReviewAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{formatDate(deal.updatedAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="text-xs font-semibold text-sky-600 underline-offset-2 transition hover:text-sky-500 hover:underline dark:text-sky-300"
                          onClick={(event) => event.stopPropagation()}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
              <span>Список сделок</span>
              {isFetching && <span className="text-xs font-normal text-slate-400">Обновление…</span>}
            </div>
            {hasDeals ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-300">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left">
                        Сделка
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Клиент
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Стадия
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Ответственный
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Вероятность
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Сумма
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Следующий просмотр
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Ожидаемое закрытие
                      </th>
                      <th scope="col" className="px-4 py-3 text-left">
                        Обновлено
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dealsForRender.map((deal) => {
                      const { isSelected, rowClassName, handleActivate, handleKeyDown } = buildRowState(deal.id);
                      const nextReviewTone = getNextReviewTone(deal.nextReviewAt);
                      const expectedCloseDateRaw = deal.expectedCloseDate;
                      const expectedCloseDate = expectedCloseDateRaw ? new Date(expectedCloseDateRaw) : undefined;
                      const isExpectedCloseOverdue = expectedCloseDate ? expectedCloseDate.getTime() < Date.now() : false;
                      const ownerLabel = getManagerLabel(normalizeManagerValue(deal.owner) ?? NO_MANAGER_VALUE);

                      return (
                        <tr
                          key={deal.id}
                          className={rowClassName}
                          onClick={handleActivate}
                          onKeyDown={handleKeyDown}
                          tabIndex={0}
                          role="button"
                          aria-pressed={isSelected}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 flex-shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={isSelected}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  toggleDealSelection(deal.id);
                                }}
                                onClick={(event) => event.stopPropagation()}
                                aria-label="Выбрать сделку"
                              />
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">{deal.name}</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">{deal.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{deal.clientName}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{deal.stage}</td>
                          <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{ownerLabel}</td>
                          <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-300">{formatProbability(deal.probability)}</td>
                          <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-300">{formatCurrency(deal.value)}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className={classNames("flex items-center gap-2 text-xs font-medium", nextReviewTone.text)}>
                                <span
                                  className={classNames("h-2 w-2 rounded-full", nextReviewTone.indicator)}
                                  aria-hidden="true"
                                />
                                Следующий просмотр
                              </span>
                              <span className={classNames("text-xs font-semibold", nextReviewTone.text)}>
                                {formatShortDate(deal.nextReviewAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {expectedCloseDate ? (
                              <span
                                className={classNames(
                                  "text-xs",
                                  isExpectedCloseOverdue
                                    ? "font-semibold text-amber-600 dark:text-amber-300"
                                    : "text-slate-400 dark:text-slate-500",
                                )}
                                title="Ожидаемая дата закрытия"
                              >
                                {expectedCloseDateRaw ? formatShortDate(expectedCloseDateRaw) : "—"}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{formatDate(deal.updatedAt)}</td>
                          <td className="px-4 py-4 text-right">
                            <Link
                              href={`/deals/${deal.id}`}
                              className="text-xs font-semibold text-sky-600 underline-offset-2 transition hover:text-sky-500 hover:underline dark:text-sky-300"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Открыть
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-300">
                <p>Сделки не найдены для выбранных фильтров.</p>
                <button
                  type="button"
                  className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-200"
                  onClick={() => clearFilters()}
                >
                  Сбросить фильтры
                </button>
              </div>
            )}
          </div>
        </div>

        <DealPreviewSidebar />
      </div>
      <DealBulkActions selectedDealIds={selectedDealIds} onClearSelection={handleHideBulkActions} />
    </>
  );
}

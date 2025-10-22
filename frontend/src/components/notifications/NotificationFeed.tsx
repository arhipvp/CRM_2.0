"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useDeleteNotifications,
  useMarkNotificationsRead,
  useNotificationFeed,
  useToggleNotificationsImportant,
} from "@/lib/api/hooks";
import { useNotificationsStore } from "@/stores/notificationsStore";
import type {
  NotificationFeedFilters,
  NotificationFeedItem,
  NotificationFeedResponse,
  NotificationFilterOption,
} from "@/types/notifications";

function formatSource(source: NotificationFeedItem["source"]): string {
  switch (source) {
    case "crm":
      return "CRM";
    case "payments":
      return "Платежи";
    default:
      return "Система";
  }
}

function formatCategory(category: NotificationFeedItem["category"]): string {
  switch (category) {
    case "deal":
      return "Сделки";
    case "task":
      return "Задачи";
    case "payment":
      return "Платежи";
    case "security":
      return "Безопасность";
    default:
      return "Система";
  }
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function buildFilterChips(options: NotificationFilterOption[], active: string | undefined, onSelect: (value: string) => void) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring focus-visible:ring-sky-500 ${
          !active || active === "all"
            ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-200"
            : "border-slate-200 text-slate-600 hover:border-sky-200 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-400"
        }`}
      >
        Все
      </button>
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring focus-visible:ring-sky-500 ${
              isActive
                ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-200"
                : "border-slate-200 text-slate-600 hover:border-sky-200 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-400"
            }`}
            aria-pressed={isActive}
          >
            {option.label}
            {option.count !== undefined ? <span className="ml-1 text-slate-400">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function NotificationFeed() {
  const lastHydratedRef = useRef<NotificationFeedResponse | undefined>(undefined);
  const filters = useNotificationsStore((state) => state.filters);
  const setFilters = useNotificationsStore((state) => state.setFilters);
  const setFeed = useNotificationsStore((state) => state.setFeed);
  const items = useNotificationsStore((state) => state.items);
  const order = useNotificationsStore((state) => state.order);
  const availableCategories = useNotificationsStore((state) => state.availableCategories);
  const availableSources = useNotificationsStore((state) => state.availableSources);
  const setAvailableFilters = useNotificationsStore((state) => state.setAvailableFilters);
  const setChannelSettings = useNotificationsStore((state) => state.setChannelSettings);
  const selectedIds = useNotificationsStore((state) => state.selectedIds);
  const toggleSelection = useNotificationsStore((state) => state.toggleSelection);
  const clearSelection = useNotificationsStore((state) => state.clearSelection);
  const notifications = useMemo(
    () =>
      order
        .map((id) => items[id])
        .filter((item): item is NotificationFeedItem => Boolean(item)),
    [items, order],
  );

  const { data, isLoading, isFetching, isError, refetch } = useNotificationFeed(filters);
  const markReadMutation = useMarkNotificationsRead();
  const markImportantMutation = useToggleNotificationsImportant();
  const deleteMutation = useDeleteNotifications();

  useEffect(() => {
    if (!data) {
      return;
    }

    if (lastHydratedRef.current === data) {
      return;
    }

    lastHydratedRef.current = data;
    setFeed(data.items, data.unreadCount);
    setAvailableFilters({ categories: data.availableCategories, sources: data.availableSources });
    setChannelSettings(data.channelSettings);
  }, [data, setAvailableFilters, setChannelSettings, setFeed]);

  const busy = isFetching && !isLoading;
  const hasSelection = selectedIds.length > 0;

  const handleCategorySelect = (value: string) => {
    setFilters({ category: value });
  };

  const handleSourceSelect = (value: string) => {
    setFilters({ source: value === "all" ? "all" : (value as NotificationFeedFilters["source"]) });
  };

  if (isLoading) {
    return <NotificationFeedSkeleton />;
  }

  if (isError) {
    return <NotificationFeedErrorState onRetry={() => refetch()} />;
  }

  if (!notifications.length) {
    return <NotificationFeedEmptyState onReset={() => setFilters({ status: "all", category: "all", source: "all", search: "" })} />;
  }

  return (
    <section className="space-y-6" aria-live="polite">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3">
            <label className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 focus-within:border-sky-400 focus-within:bg-white focus-within:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus-within:border-sky-500">
              <span className="whitespace-nowrap">Поиск</span>
              <input
                type="search"
                value={filters.search ?? ""}
                onChange={(event) => setFilters({ search: event.target.value })}
                placeholder="Найти по тексту, клиенту или сделке"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <div className="space-y-2 text-xs">
              <p className="font-medium text-slate-500 dark:text-slate-400">Категории</p>
              {buildFilterChips(availableCategories, filters.category, handleCategorySelect)}
            </div>
          </div>
          <div className="space-y-2 text-xs lg:w-1/3">
            <p className="font-medium text-slate-500 dark:text-slate-400">Источник</p>
            {buildFilterChips(availableSources, filters.source, handleSourceSelect)}
          </div>
        </div>

        {busy ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Синхронизируем свежие уведомления...</p>
        ) : null}
      </div>

      {hasSelection ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          <div>
            Выбрано уведомлений: <span className="font-semibold">{selectedIds.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => markReadMutation.mutate({ ids: selectedIds })}
              disabled={markReadMutation.isPending}
              className="rounded-full border border-sky-400 px-3 py-1 font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-600 dark:text-sky-200 dark:hover:bg-sky-900"
            >
              Отметить прочитанными
            </button>
            <button
              type="button"
              onClick={() => markImportantMutation.mutate({ ids: selectedIds, important: true })}
              disabled={markImportantMutation.isPending}
              className="rounded-full border border-amber-400 px-3 py-1 font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              Сделать важными
            </button>
            <button
              type="button"
              onClick={() => markImportantMutation.mutate({ ids: selectedIds, important: false })}
              disabled={markImportantMutation.isPending}
              className="rounded-full border border-slate-300 px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Снять важность
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate({ ids: selectedIds })}
              disabled={deleteMutation.isPending}
              className="rounded-full border border-rose-400 px-3 py-1 font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-600 dark:text-rose-200 dark:hover:bg-rose-900/40"
            >
              Удалить
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-transparent px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Очистить выбор
            </button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-4">
        {notifications.map((notification) => {
          const isSelected = selectedIds.includes(notification.id);
          return (
            <li
              key={notification.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-800"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-1 items-start gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(notification.id)}
                    aria-label={`Выбрать уведомление ${notification.title}`}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.read ? (
                        <span
                          className="mr-1 inline-flex h-2 w-2 rounded-full bg-sky-500"
                          aria-label="Непрочитано"
                        />
                      ) : null}
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {notification.title}
                      </h3>
                      {notification.important ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                          Важно
                        </span>
                      ) : null}
                      {notification.deliveryStatus === "failed" ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                          Ошибка доставки
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
                    {notification.tags && notification.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {notification.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{formatCategory(notification.category)}</span>
                      <span>{formatSource(notification.source)}</span>
                      <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                      {notification.context?.link ? (
                        <a
                          href={notification.context.link.href}
                          className="font-medium text-sky-600 underline-offset-4 hover:underline dark:text-sky-300"
                        >
                          {notification.context.link.label ?? "Открыть"}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-row gap-2 md:flex-col">
                  <button
                    type="button"
                    onClick={() => markReadMutation.mutate({ ids: [notification.id] })}
                    disabled={markReadMutation.isPending}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
                  >
                    Прочитано
                  </button>
                  <button
                    type="button"
                    onClick={() => markImportantMutation.mutate({ ids: [notification.id], important: !notification.important })}
                    disabled={markImportantMutation.isPending}
                    className="rounded-full border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40"
                  >
                    {notification.important ? "Снять важность" : "Сделать важным"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function NotificationFeedSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Загрузка уведомлений">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mb-2 h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

export function NotificationFeedErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
      <p className="font-medium">Не удалось загрузить уведомления.</p>
      <p className="mb-4 mt-1 text-rose-600 dark:text-rose-300">
        Проверьте подключение к сети или попробуйте обновить страницу чуть позже.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
      >
        Повторить попытку
      </button>
    </div>
  );
}

export function NotificationFeedEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-sky-100 text-3xl text-sky-600 dark:bg-sky-900/40 dark:text-sky-200">
        <span className="inline-block translate-y-3">🔔</span>
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Новых уведомлений нет</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Попробуйте изменить фильтры или включите дополнительные каналы доставки, чтобы ничего не пропустить.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
      >
        Показать все уведомления
      </button>
    </div>
  );
}

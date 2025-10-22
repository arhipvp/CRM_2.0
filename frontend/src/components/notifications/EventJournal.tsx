"use client";

import { useMemo, useState } from "react";
import { useNotificationEventJournal } from "@/lib/api/hooks";
import type {
  NotificationEventEntry,
  NotificationEventJournalFilters,
  NotificationFilterOption,
} from "@/types/notifications";

function formatSeverity(severity: NotificationEventEntry["severity"]): { label: string; tone: string } {
  switch (severity) {
    case "warning":
      return { label: "Предупреждение", tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" };
    case "error":
      return { label: "Ошибка", tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200" };
    default:
      return { label: "Инфо", tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200" };
  }
}

function buildFilter(options: NotificationFilterOption[], value: string | undefined, onChange: (value: string) => void) {
  return (
    <select
      value={value ?? "all"}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus-visible:ring focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      <option value="all">Все</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function EventJournal() {
  const [filters, setFilters] = useState<NotificationEventJournalFilters>({ severity: "all", source: "all", category: "all" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);
  const { data, isLoading, isError, refetch } = useNotificationEventJournal(filters);

  const events = data?.items ?? [];
  const availableCategories = useMemo(() => data?.availableCategories ?? [], [data?.availableCategories]);
  const availableSources = useMemo(() => data?.availableSources ?? [], [data?.availableSources]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const acknowledgeSelected = () => {
    if (selectedIds.length === 0) {
      return;
    }

    setAcknowledgedIds((current) => Array.from(new Set([...current, ...selectedIds])));
    setSelectedIds([]);
  };

  if (isLoading) {
    return <EventJournalSkeleton />;
  }

  if (isError) {
    return <EventJournalErrorState onRetry={() => refetch()} />;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Журнал событий</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          История действий и системных изменений. Выделите строки, чтобы отметить их как просмотренные.
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="flex min-w-[180px] flex-col gap-1 text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">Категория</span>
            {buildFilter(availableCategories, filters.category, (value) => setFilters((prev) => ({ ...prev, category: value })))}
          </div>
          <div className="flex min-w-[180px] flex-col gap-1 text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">Источник</span>
            {buildFilter(availableSources, filters.source, (value) =>
              setFilters((prev) => ({
                ...prev,
                source: value as NotificationEventJournalFilters["source"],
              })),
            )}
          </div>
          <div className="flex min-w-[180px] flex-col gap-1 text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">Статус</span>
            <select
              value={filters.severity ?? "all"}
              onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value as typeof prev.severity }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus-visible:ring focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="all">Все</option>
              <option value="info">Инфо</option>
              <option value="warning">Предупреждения</option>
              <option value="error">Ошибки</option>
            </select>
          </div>
        </div>
        <label className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 focus-within:border-sky-400 focus-within:bg-white focus-within:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus-within:border-sky-500 lg:w-auto lg:flex-1">
          <span className="whitespace-nowrap">Поиск</span>
          <input
            type="search"
            value={filters.search ?? ""}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Фильтр по тексту"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          <span>Выбрано записей: {selectedIds.length}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={acknowledgeSelected}
              className="rounded-full bg-sky-600 px-3 py-1 font-medium text-white transition hover:bg-sky-500"
            >
              Отметить просмотренными
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-full border border-transparent px-3 py-1 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Очистить
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">
                <span className="sr-only">Выбрать</span>
              </th>
              <th scope="col" className="px-4 py-3 text-left">Событие</th>
              <th scope="col" className="px-4 py-3 text-left">Источник</th>
              <th scope="col" className="px-4 py-3 text-left">Время</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {events.map((event) => {
              const severity = formatSeverity(event.severity);
              const selected = selectedIds.includes(event.id);
              const acknowledged = acknowledgedIds.includes(event.id);
              return (
                <tr key={event.id} className={acknowledged ? "opacity-70" : undefined}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelection(event.id)}
                      aria-label={`Выбрать событие ${event.summary}`}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{event.summary}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-300">{event.actor}</span>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${severity.tone}`}>
                          {severity.label}
                        </span>
                        {event.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{event.source.toUpperCase()}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-300">
                    {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
                      new Date(event.timestamp),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {events.length === 0 ? <EventJournalEmptyState /> : null}
      </div>
    </section>
  );
}

export function EventJournalSkeleton() {
  return (
    <section className="space-y-3" role="status" aria-label="Загрузка журнала" aria-live="polite">
      <div className="h-8 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ))}
    </section>
  );
}

export function EventJournalErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
        <p className="font-semibold">Не удалось получить журнал событий.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-full bg-rose-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-rose-500"
        >
          Повторить загрузку
        </button>
      </div>
    </section>
  );
}

export function EventJournalEmptyState() {
  return (
    <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
      Событий не найдено. Измените фильтры или период поиска.
    </p>
  );
}

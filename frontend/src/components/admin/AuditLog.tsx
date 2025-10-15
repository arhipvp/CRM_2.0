"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useAdminAuditLog, useExportAdminAuditLog } from "@/lib/api/admin/hooks";
import { triggerDownload } from "@/lib/utils/export";
import {
  mapAuditFilters,
  useAdminFiltersStore,
} from "@/stores/adminFiltersStore";
import { useHasAdminPermission } from "@/stores/adminAccessStore";
import type { AdminAuditLogEntry } from "@/types/admin";

const scopeOptions: Array<{ value: AdminAuditLogEntry["scope"] | "all"; label: string }> = [
  { value: "all", label: "Все области" },
  { value: "user", label: "Пользователи" },
  { value: "dictionary", label: "Справочники" },
  { value: "security", label: "Безопасность" },
  { value: "integration", label: "Интеграции" },
];

const severityOptions: Array<{ value: AdminAuditLogEntry["severity"] | "all"; label: string }> = [
  { value: "all", label: "Любая важность" },
  { value: "info", label: "Информация" },
  { value: "warning", label: "Предупреждения" },
  { value: "critical", label: "Критические" },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AuditLog() {
  const canViewAudit = useHasAdminPermission("view:audit");
  const canExportAudit = useHasAdminPermission("export:audit");

  const auditFilters = useAdminFiltersStore((state) => state.auditFilters);
  const setAuditSearch = useAdminFiltersStore((state) => state.setAuditSearch);
  const setAuditScope = useAdminFiltersStore((state) => state.setAuditScope);
  const setAuditSeverity = useAdminFiltersStore((state) => state.setAuditSeverity);
  const toggleAuditActor = useAdminFiltersStore((state) => state.toggleAuditActor);
  const setAuditDateRange = useAdminFiltersStore((state) => state.setAuditDateRange);
  const clearAuditFilters = useAdminFiltersStore((state) => state.clearAuditFilters);

  const queryFilters = useMemo(() => mapAuditFilters(auditFilters), [auditFilters]);

  const auditQuery = useAdminAuditLog(queryFilters);
  const exportAudit = useExportAdminAuditLog();

  const [rangeError, setRangeError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const entries = auditQuery.data ?? [];
  const isExporting = exportAudit.isPending;

  const actors = useMemo(() => {
    const unique = new Map<string, string>();
    for (const entry of entries) {
      unique.set(entry.actorId, entry.actorName);
    }
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [entries]);

  const handleDateChange = (type: "from" | "to", value: string) => {
    setFeedback(null);
    setRequestError(null);
    setRangeError(null);
    if (type === "from") {
      setAuditDateRange({ from: value ? new Date(value).toISOString() : null });
    } else {
      setAuditDateRange({ to: value ? new Date(value).toISOString() : null });
    }

    const from = type === "from" ? value : auditFilters.dateFrom?.slice(0, 10);
    const to = type === "to" ? value : auditFilters.dateTo?.slice(0, 10);
    if (from && to && from > to) {
      setRangeError("Дата начала не может быть позже даты окончания");
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    setFeedback(null);
    setRequestError(null);
    try {
      const result = await exportAudit.mutateAsync({ format, filters: queryFilters });
      triggerDownload({ fileName: result.fileName, content: result.content, mimeType: result.mimeType });
      setFeedback(`Выгрузка подготовлена (${format.toUpperCase()})`);
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError(error.message);
      } else if (error instanceof Error) {
        setRequestError(error.message);
      } else {
        setRequestError("Не удалось выгрузить аудит");
      }
    }
  };

  return (
    <section aria-labelledby="admin-audit-log" className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="admin-audit-log" className="text-xl font-semibold text-slate-900 dark:text-white">
              Журнал аудита
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Отслеживайте ключевые операции и экспортируйте отчёты для аудита.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport("json")}
              disabled={!canExportAudit || entries.length === 0 || isExporting}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
              Экспорт JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={!canExportAudit || entries.length === 0 || isExporting}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
            >
              Экспорт CSV
            </button>
          </div>
        </div>
        {!canViewAudit && (
          <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            У вас нет прав на просмотр аудита. Доступ возможен только для главного админа.
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Поиск</span>
          <input
            type="search"
            value={auditFilters.search}
            onChange={(event) => setAuditSearch(event.target.value)}
            placeholder="Пользователь или событие"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Область</span>
          <select
            value={auditFilters.scope}
            onChange={(event) => setAuditScope(event.target.value as AdminAuditLogEntry["scope"] | "all")}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {scopeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Важность</span>
          <select
            value={auditFilters.severity}
            onChange={(event) => setAuditSeverity(event.target.value as AdminAuditLogEntry["severity"] | "all")}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {severityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">С даты</span>
            <input
              type="date"
              value={auditFilters.dateFrom ? auditFilters.dateFrom.slice(0, 10) : ""}
              onChange={(event) => handleDateChange("from", event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">По дату</span>
            <input
              type="date"
              value={auditFilters.dateTo ? auditFilters.dateTo.slice(0, 10) : ""}
              onChange={(event) => handleDateChange("to", event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2" aria-label="Пользователи">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Пользователи</span>
        <div className="flex flex-wrap gap-2">
          {actors.length === 0 ? (
            <span className="text-xs text-slate-400">Журнал пуст — список пользователей появится после загрузки.</span>
          ) : (
            actors.map((actor) => (
              <label key={actor.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={auditFilters.actorIds.includes(actor.id)}
                  onChange={() => toggleAuditActor(actor.id)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                {actor.name}
              </label>
            ))
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={clearAuditFilters}
          className="text-sm font-medium text-sky-600 hover:underline disabled:opacity-50"
          disabled={
            auditFilters.search.length === 0 &&
            auditFilters.scope === "all" &&
            auditFilters.severity === "all" &&
            auditFilters.actorIds.length === 0 &&
            !auditFilters.dateFrom &&
            !auditFilters.dateTo
          }
        >
          Сбросить фильтры
        </button>
        {auditQuery.isFetching && (
          <span role="status" className="text-xs text-slate-500 dark:text-slate-400">
            Обновляем данные…
          </span>
        )}
      </div>

      {rangeError && <p className="text-sm text-rose-600">{rangeError}</p>}
      {feedback && <p className="text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p>}
      {requestError && <p className="text-sm text-rose-600">{requestError}</p>}

      {!canViewAudit ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Просмотр журнала недоступен. Обратитесь к главному администратору.
        </div>
      ) : auditQuery.isLoading ? (
        <div role="status" className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Загрузка аудита…
        </div>
      ) : auditQuery.isError ? (
        <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          <p>Не удалось загрузить аудит: {(auditQuery.error as Error)?.message ?? "ошибка"}</p>
          <button
            type="button"
            onClick={() => auditQuery.refetch()}
            className="rounded-full border border-rose-400 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-500 hover:text-rose-800 dark:border-rose-600 dark:text-rose-200"
          >
            Повторить
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Записей аудита не найдено. Попробуйте изменить фильтры.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Дата и время
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Пользователь
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Область
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Событие
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Описание
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Важность
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {entries.map((entry) => (
                <tr key={entry.id} className="bg-white transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatDateTime(entry.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{entry.actorName}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{entry.actorRole}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {scopeOptions.find((option) => option.value === entry.scope)?.label ?? entry.scope}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.action}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.summary}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        entry.severity === "critical"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                          : entry.severity === "warning"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-200"
                      }`}
                    >
                      {severityOptions.find((option) => option.value === entry.severity)?.label ?? entry.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

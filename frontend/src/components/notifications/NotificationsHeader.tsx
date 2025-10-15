"use client";

import { useMemo } from "react";
import { useNotificationsStore } from "@/stores/notificationsStore";

const STATUS_OPTIONS: Array<{ value: "all" | "unread" | "important" | "failed"; label: string }> = [
  { value: "all", label: "Все" },
  { value: "unread", label: "Непрочитанные" },
  { value: "important", label: "Важные" },
  { value: "failed", label: "Ошибки" },
];

export function NotificationsHeader() {
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const filters = useNotificationsStore((state) => state.filters);
  const setFilters = useNotificationsStore((state) => state.setFilters);
  const resetFilters = useNotificationsStore((state) => state.resetFilters);

  const statusOptions = useMemo(() => STATUS_OPTIONS, []);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Уведомления и журнал событий
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Управляйте входящими уведомлениями, настройками доставки и аудитом изменений в одном окне.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
            Непрочитанных: <span className="font-semibold">{unreadCount}</span>
          </span>
          <span>Выберите статус, чтобы сфокусироваться на важных обновлениях.</span>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 sm:items-end">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs font-medium shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {statusOptions.map((option) => {
            const isActive = filters.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilters({ status: option.value })}
                className={`rounded-full px-3 py-1 transition focus:outline-none focus-visible:ring focus-visible:ring-sky-500 ${
                  isActive
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="text-sm font-medium text-slate-600 underline-offset-2 transition hover:text-sky-600 hover:underline dark:text-slate-300"
        >
          Сбросить фильтры
        </button>
      </div>
    </header>
  );
}

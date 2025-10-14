"use client";

import { useMemo, useState } from "react";
import type { ActivityLogEntry } from "@/types/crm";

interface JournalTabProps {
  activity: ActivityLogEntry[];
}

type ActivityFilter = "all" | ActivityLogEntry["type"];

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function JournalTab({ activity }: JournalTabProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [search, setSearch] = useState("");

  const entries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return activity.filter((entry) => {
      if (filter !== "all" && entry.type !== filter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const haystack = `${entry.message} ${entry.author}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [activity, filter, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Тип события:</span>
          {(["all", "note", "email", "meeting", "system"] as ActivityFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === option
                  ? "border-sky-600 bg-sky-50 text-sky-600 dark:border-sky-500 dark:bg-sky-900/20 dark:text-sky-200"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {option === "all" ? "Все" : option}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по журналу"
            className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Добавить событие
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
          В журнале пока нет записей. Добавьте событие вручную или включите интеграцию автоматических уведомлений.
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {entry.type}
                </span>
                <span className="text-xs text-slate-400">{formatDate(entry.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{entry.message}</p>
              <p className="text-xs text-slate-500">Автор: {entry.author}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import type { DealActionsPanel } from "@/types/crm";

interface ActionsTabProps {
  actions: DealActionsPanel;
}

export function ActionsTab({ actions }: ActionsTabProps) {
  return (
    <section className="space-y-4">
      {actions.banners.map((banner) => (
        <div
          key={banner.id}
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
            banner.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200"
              : banner.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200"
                : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-900/20 dark:text-sky-200"
          }`}
        >
          <span className="mt-0.5 text-base font-semibold">!</span>
          <p>{banner.message}</p>
        </div>
      ))}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Быстрые действия</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {actions.shortcuts.map((shortcut) => (
            <button
              key={shortcut.id}
              type="button"
              className="flex h-full flex-col justify-between rounded-lg border border-slate-200 p-4 text-left text-sm transition hover:border-sky-200 hover:shadow-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-slate-700 dark:hover:border-sky-500/60"
              disabled={Boolean(shortcut.disabledReason)}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{shortcut.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">{shortcut.description}</p>
              </div>
              {shortcut.disabledReason ? (
                <span className="mt-3 text-xs text-rose-500">{shortcut.disabledReason}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Интеграции</h3>
        {actions.integrations.length === 0 ? (
          <p className="text-sm text-slate-500">Подключите интеграции, чтобы автоматизировать действия по сделке.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {actions.integrations.map((integration) => (
              <li
                key={integration.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{integration.label}</p>
                  <p className="text-xs text-slate-500">{integration.description}</p>
                  {integration.errorMessage ? (
                    <p className="text-xs text-rose-500">{integration.errorMessage}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={integration.status === "disabled"}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                    integration.status === "error"
                      ? "border-rose-300 text-rose-600 hover:border-rose-400"
                      : integration.status === "disabled"
                        ? "border-slate-200 text-slate-400"
                        : "border-sky-200 text-sky-600 hover:border-sky-300"
                  }`}
                >
                  {integration.actionLabel ?? "Открыть"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

"use client";

import { useUiStore } from "@/stores/uiStore";

export function NotificationCenter() {
  const { notifications, dismissNotification } = useUiStore((state) => ({
    notifications: state.notifications,
    dismissNotification: state.dismissNotification,
  }));

  if (notifications.length === 0) {
    return null;
  }

  return (
    <aside className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {notifications.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg transition dark:border-slate-700 dark:bg-slate-900/90 ${
            item.type === "success"
              ? "border-emerald-200"
              : item.type === "error"
                ? "border-rose-200"
                : item.type === "warning"
                  ? "border-amber-200"
                  : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.source === "crm" ? "CRM" : "Уведомления"}</p>
              <p className="text-sm text-slate-600 dark:text-slate-200">{item.message}</p>
              <time className="text-xs text-slate-400" dateTime={item.timestamp}>
                {new Intl.DateTimeFormat("ru-RU", { timeStyle: "short" }).format(new Date(item.timestamp))}
              </time>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(item.id)}
              className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
            >
              Закрыть
            </button>
          </div>
        </div>
      ))}
    </aside>
  );
}

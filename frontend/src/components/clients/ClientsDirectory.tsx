"use client";

import { useClients } from "@/lib/api/hooks";

const statusLabels = {
  active: "Активный",
  paused: "Приостановлен",
  archived: "Архив",
} as const;

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function formatCurrency(value: number) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
  } catch (error) {
    return `${value.toLocaleString("ru-RU")} ₽`;
  }
}

export function ClientsDirectory() {
  const { data: clients, isLoading, isError } = useClients();

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
        Не удалось загрузить клиентов. Попробуйте обновить страницу позже.
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
        Клиенты не найдены. Создайте первую карточку клиента, чтобы начать вести базу CRM.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            <th scope="col" className="px-6 py-3">
              Клиент
            </th>
            <th scope="col" className="px-6 py-3">
              Контакты
            </th>
            <th scope="col" className="px-6 py-3">
              Город
            </th>
            <th scope="col" className="px-6 py-3 text-right">
              Сделок
            </th>
            <th scope="col" className="px-6 py-3 text-right">
              LTV
            </th>
            <th scope="col" className="px-6 py-3">
              Последняя активность
            </th>
            <th scope="col" className="px-6 py-3">
              Статус
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                <div className="flex flex-col">
                  <span>{client.name}</span>
                  {client.owner ? (
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      Ответственный: {client.owner}
                    </span>
                  ) : null}
                  {client.tags && client.tags.length > 0 ? (
                    <span className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                      Теги: {client.tags.join(", ")}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-200">
                <div className="flex flex-col gap-1">
                  <span>{client.email}</span>
                  <span>{client.phone}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-200">{client.city}</td>
              <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-200">{client.totalDeals}</td>
              <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-200">
                {formatCurrency(client.lifetimeValue)}
              </td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-200">{formatDate(client.lastActivityAt)}</td>
              <td className="px-6 py-4">
                {client.status ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {statusLabels[client.status] ?? client.status}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useClient, useClientActivity } from "@/lib/api/hooks";

export function ClientSummary({ clientId }: { clientId: string }) {
  const { data: client } = useClient(clientId);
  const { data: activity } = useClientActivity(clientId);

  if (!client) {
    return <p className="text-sm text-slate-500">Клиент не найден.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{client.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {client.industry} • {client.city}
          </p>
        </header>
        <dl className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-200">
          <div>
            <dt className="font-medium">E-mail</dt>
            <dd>{client.email}</dd>
          </div>
          <div>
            <dt className="font-medium">Телефон</dt>
            <dd>{client.phone}</dd>
          </div>
          <div>
            <dt className="font-medium">LTV</dt>
            <dd>{new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(client.lifetimeValue)}</dd>
          </div>
          <div>
            <dt className="font-medium">Сделок в работе</dt>
            <dd>{client.totalDeals}</dd>
          </div>
        </dl>
        <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
          <p className="font-medium text-slate-700 dark:text-slate-100">Последняя активность</p>
          <p className="text-slate-500 dark:text-slate-300">
            {new Intl.DateTimeFormat("ru-RU", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(client.lastActivityAt))}
          </p>
        </div>
      </section>

      <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Лента активности</h2>
        <ol className="space-y-4 text-sm">
          {(activity ?? []).map((item) => (
            <li key={item.id} className="border-l-2 border-slate-200 pl-4 dark:border-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.type}</p>
              <p className="font-medium text-slate-700 dark:text-slate-200">{item.author}</p>
              <p className="text-slate-500 dark:text-slate-300">{item.message}</p>
              <time className="text-xs text-slate-400" dateTime={item.createdAt}>
                {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
              </time>
            </li>
          ))}
          {(activity?.length ?? 0) === 0 && <p className="text-slate-500 dark:text-slate-300">Пока нет активности.</p>}
        </ol>
        <Link
          href="/tasks"
          className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          Запланировать задачу
        </Link>
      </aside>
    </div>
  );
}

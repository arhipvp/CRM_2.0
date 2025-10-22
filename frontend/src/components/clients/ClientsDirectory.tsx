"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useClients } from "@/lib/api/hooks";
import { ClientCreateModal } from "./ClientCreateModal";
import type { Client } from "@/types/crm";

const statusLabels = {
  active: "Активный",
  paused: "Приостановлен",
  archived: "Архив",
} as const;

const statusColors = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  archived: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
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

interface ClientsDirectoryProps {
  onClientCreated?: (client: Client) => void;
}

export function ClientsDirectory({ onClientCreated }: ClientsDirectoryProps) {
  const { data: clients, isLoading, isError, refetch } = useClients();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "archived">("all");
  const [sortBy, setSortBy] = useState<"name" | "ltv" | "deals" | "lastActivity">("name");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredAndSortedClients = useMemo(() => {
    if (!clients) return [];

    let result = [...clients];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((client) => client.name.toLowerCase().includes(query));
    }

    if (statusFilter !== "all") {
      result = result.filter((client) => client.status === statusFilter);
    }

    switch (sortBy) {
      case "ltv":
        result.sort((a, b) => b.lifetimeValue - a.lifetimeValue);
        break;
      case "deals":
        result.sort((a, b) => b.totalDeals - a.totalDeals);
        break;
      case "lastActivity":
        result.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
        break;
      case "name":
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [clients, searchQuery, statusFilter, sortBy]);

  const handleClientCreated = useCallback(
    (client: Client) => {
      refetch();
      onClientCreated?.(client);
      setIsCreateModalOpen(false);
    },
    [refetch, onClientCreated],
  );

  const uniqueManagers = useMemo(() => {
    if (!clients) return [];
    const managers = new Set<string>();
    clients.forEach((client) => {
      if (client.owner) {
        managers.add(client.owner);
      }
    });
    return Array.from(managers).sort();
  }, [clients]);

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
      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40">
        <p className="text-sm text-rose-700 dark:text-rose-200">
          Не удалось загрузить клиентов. Попробуйте обновить страницу позже.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg bg-rose-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-rose-500"
        >
          Повторить
        </button>
      </div>
    );
  }

  const hasClients = clients && clients.length > 0;
  const hasResults = filteredAndSortedClients.length > 0;

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию клиента..."
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:placeholder-slate-400 dark:text-white dark:focus:ring-sky-900"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              <span>+</span>
              <span>Новый клиент</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="status-filter" className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Статус:
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">Все</option>
                <option value="active">Активные</option>
                <option value="paused">Приостановленные</option>
                <option value="archived">Архив</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-by" className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Сортировка:
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="name">По названию</option>
                <option value="ltv">По LTV (↓)</option>
                <option value="deals">По сделкам (↓)</option>
                <option value="lastActivity">По активности (↓)</option>
              </select>
            </div>
          </div>
        </div>

        {hasClients && (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {filteredAndSortedClients.length} из {clients.length} клиентов
          </div>
        )}

        {!hasClients && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Клиенты не найдены. Создайте первую карточку клиента, чтобы начать вести базу CRM.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              <span>+</span>
              <span>Создать клиента</span>
            </button>
          </div>
        )}

        {hasClients && !hasResults && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              По вашему поиску ничего не найдено. Попробуйте изменить фильтры.
            </p>
          </div>
        )}

        {hasResults && (
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
                {filteredAndSortedClients.map((client) => (
                  <tr
                    key={client.id}
                    className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      <Link href={`/clients/${client.id}`} className="flex flex-col hover:underline">
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
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-200">
                      <div className="flex flex-col gap-1">
                        <span>{client.email}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{client.phone}</span>
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
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColors[client.status]}`}>
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
        )}
      </div>

      <ClientCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        owners={uniqueManagers}
        onClientCreated={handleClientCreated}
      />
    </>
  );
}

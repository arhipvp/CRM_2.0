"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useClient,
  useClientActivity,
  useClientPolicies,
  useClientReminders,
  useClientTaskChecklist,
  useCreateClientPolicy,
  useToggleClientChecklistTask,
  useUpdateClientContacts,
  useUpdateClientPolicy,
} from "@/lib/api/hooks";
import type {
  ActivityLogEntry,
  Client,
  ClientPolicy,
  ClientPolicyStatus,
  ClientReminderCalendarItem,
  ClientTaskChecklistItem,
} from "@/types/crm";
import type { UpsertClientPolicyPayload, UpdateClientContactsPayload } from "@/lib/api/client";
import { Modal } from "@/components/payments/Modal";

type TabKey = "profile" | "policies" | "activity" | "tasks";
type ActivityFilter = "all" | ActivityLogEntry["type"];

interface ClientWorkspaceProps {
  clientId: string;
}

interface PolicyFormState {
  number: string;
  product: string;
  insurer: string;
  premium: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: ClientPolicyStatus;
}

const policyStatusLabels: Record<ClientPolicyStatus, { label: string; tone: "slate" | "green" | "amber" | "red" | "blue" }> = {
  draft: { label: "Черновик", tone: "slate" },
  pending: { label: "На согласовании", tone: "amber" },
  active: { label: "Активен", tone: "green" },
  expiring: { label: "Истекает", tone: "amber" },
  expired: { label: "Истёк", tone: "red" },
  cancelled: { label: "Отменён", tone: "red" },
  archived: { label: "Архив", tone: "slate" },
};

const kycStatusLabels = {
  pending: "Не пройден",
  in_review: "На проверке",
  verified: "KYC подтверждён",
  rejected: "KYC отклонён",
} as const;

const toneClasses: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  red: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
};

const activityTypeLabels: Record<ActivityFilter, string> = {
  all: "Все события",
  email: "Письма",
  meeting: "Встречи",
  note: "Заметки",
  system: "Системные",
};

const activityTypes: ActivityFilter[] = ["all", "email", "meeting", "note", "system"];

const archivedPolicyStatuses: ClientPolicyStatus[] = ["archived", "cancelled", "expired"];

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch (error) {
    return `${value.toLocaleString("ru-RU")} ${currency}`;
  }
}

function formatDate(value?: string, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", options ?? { dateStyle: "medium" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function initialPolicyForm(policy?: ClientPolicy): PolicyFormState {
  return {
    number: policy?.number ?? "",
    product: policy?.product ?? "",
    insurer: policy?.insurer ?? "",
    premium: policy ? String(policy.premium) : "",
    currency: policy?.currency ?? "RUB",
    periodStart: policy?.periodStart ? policy.periodStart.slice(0, 10) : "",
    periodEnd: policy?.periodEnd ? policy.periodEnd.slice(0, 10) : "",
    status: policy?.status ?? "pending",
  };
}

function sanitizeContactsPayload(client: Client | undefined, payload: { email: string; phone: string }): UpdateClientContactsPayload {
  const contacts = [...(client?.contacts ?? [])];
  const emailIndex = contacts.findIndex((item) => item.type === "email");
  const phoneIndex = contacts.findIndex((item) => item.type === "phone");

  const emailContact = {
    id: emailIndex >= 0 ? contacts[emailIndex].id : undefined,
    type: "email" as const,
    label: contacts[emailIndex]?.label ?? "E-mail",
    value: payload.email,
    primary: true,
  };

  const phoneContact = {
    id: phoneIndex >= 0 ? contacts[phoneIndex].id : undefined,
    type: "phone" as const,
    label: contacts[phoneIndex]?.label ?? "Телефон",
    value: payload.phone,
    primary: true,
  };

  if (emailIndex >= 0) {
    contacts[emailIndex] = emailContact;
  } else {
    contacts.unshift(emailContact);
  }

  if (phoneIndex >= 0) {
    contacts[phoneIndex] = phoneContact;
  } else {
    contacts.push(phoneContact);
  }

  return {
    email: payload.email,
    phone: payload.phone,
    contacts,
  };
}

interface ProfileSectionProps {
  client: Client;
  onEditContacts: () => void;
}

function ProfileSection({ client, onEditContacts }: ProfileSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <header className="flex flex-wrap items-center gap-3">
          {client.status ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
              Статус: {client.status === "active" ? "Активный" : client.status === "paused" ? "Приостановлен" : "Архив"}
            </span>
          ) : null}
          {client.segment ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              Сегмент: {client.segment}
            </span>
          ) : null}
          {client.kycStatus ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              {kycStatusLabels[client.kycStatus] ?? client.kycStatus}
            </span>
          ) : null}
        </header>

        <dl className="grid gap-4 text-sm text-slate-600 dark:text-slate-200 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-300">E-mail</dt>
            <dd>{client.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-300">Телефон</dt>
            <dd>{client.phone}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-300">Индустрия</dt>
            <dd>{client.industry}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-300">Город</dt>
            <dd>{client.city}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-300">Менеджер</dt>
            <dd>{client.owner ?? "Не назначен"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500 dark:text-slate-300">LTV</dt>
            <dd>{formatCurrency(client.lifetimeValue, "RUB")}</dd>
          </div>
        </dl>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Контакты</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-200">
            {(client.contacts ?? []).map((contact) => (
              <li key={contact.id} className="rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700">
                <p className="font-medium text-slate-500 dark:text-slate-300">{contact.label}</p>
                <p>{contact.value}</p>
                {contact.comment ? <p className="text-xs text-slate-400 dark:text-slate-500">{contact.comment}</p> : null}
              </li>
            ))}
            {(client.contacts ?? []).length === 0 ? <li>Дополнительные контакты не указаны.</li> : null}
          </ul>
        </div>

        {client.notes ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Комментарии</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">{client.notes}</p>
          </div>
        ) : null}
      </section>

      <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Метки клиента</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(client.tags ?? []).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {tag}
              </span>
            ))}
            {(client.tags ?? []).length === 0 ? (
              <span className="text-sm text-slate-500 dark:text-slate-300">Нет назначенных меток.</span>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/70">
          <p className="font-medium text-slate-600 dark:text-slate-100">Последняя активность</p>
          <p className="text-slate-500 dark:text-slate-300">{formatDate(client.lastActivityAt, { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>

        <button
          type="button"
          onClick={onEditContacts}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-500 hover:text-sky-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500"
        >
          Редактировать контакты
        </button>
      </aside>
    </div>
  );
}

interface PoliciesSectionProps {
  clientId: string;
  activePolicies?: ClientPolicy[];
  archivedPolicies?: ClientPolicy[];
  isActiveLoading: boolean;
  isActiveError: boolean;
  activeError?: unknown;
  refetchActive: () => void;
  isArchivedLoading: boolean;
  isArchivedError: boolean;
  archivedError?: unknown;
  refetchArchived: () => void;
  onCreatePolicy: () => void;
  onEditPolicy: (policy: ClientPolicy) => void;
}

function PoliciesSection({
  activePolicies,
  archivedPolicies,
  isActiveLoading,
  isActiveError,
  activeError,
  refetchActive,
  isArchivedLoading,
  isArchivedError,
  archivedError,
  refetchArchived,
  onCreatePolicy,
  onEditPolicy,
}: PoliciesSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Активные полисы</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">Управляйте продлением и параметрами действующих программ.</p>
        </div>
        <button
          type="button"
          onClick={onCreatePolicy}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
        >
          Добавить полис
        </button>
      </div>

      {isActiveLoading ? <p className="text-sm text-slate-500">Загрузка активных полисов…</p> : null}
      {isActiveError ? (
        <ErrorBanner
          title="Не удалось получить активные полисы"
          description={(activeError as Error)?.message}
          onRetry={refetchActive}
        />
      ) : null}

      {!isActiveLoading && !isActiveError ? (
        <PolicyTable policies={activePolicies ?? []} emptyMessage="Активных полисов пока нет." onEdit={onEditPolicy} />
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Архив</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">Завершённые или отменённые программы клиента.</p>
      </div>

      {isArchivedLoading ? <p className="text-sm text-slate-500">Загрузка архивных полисов…</p> : null}
      {isArchivedError ? (
        <ErrorBanner
          title="Не удалось получить архивные полисы"
          description={(archivedError as Error)?.message}
          onRetry={refetchArchived}
        />
      ) : null}

      {!isArchivedLoading && !isArchivedError ? (
        <PolicyTable
          policies={archivedPolicies ?? []}
          emptyMessage="Архивных полисов пока нет."
          onEdit={onEditPolicy}
          disableEdit
        />
      ) : null}
    </div>
  );
}

interface PolicyTableProps {
  policies: ClientPolicy[];
  emptyMessage: string;
  onEdit: (policy: ClientPolicy) => void;
  disableEdit?: boolean;
}

function PolicyTable({ policies, emptyMessage, onEdit, disableEdit = false }: PolicyTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            <th scope="col" className="px-4 py-3">Номер</th>
            <th scope="col" className="px-4 py-3">Продукт</th>
            <th scope="col" className="px-4 py-3">Период</th>
            <th scope="col" className="px-4 py-3">Премия</th>
            <th scope="col" className="px-4 py-3">Ответственный</th>
            <th scope="col" className="px-4 py-3">Статус</th>
            <th scope="col" className="px-4 py-3 text-right">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {policies.map((policy) => (
            <tr key={policy.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                <div className="flex flex-col">
                  <span>{policy.number}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{policy.insurer}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
                <div className="flex flex-col">
                  <span>{policy.product}</span>
                  {policy.coverageSummary ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500">{policy.coverageSummary}</span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
                {formatDate(policy.periodStart)} — {formatDate(policy.periodEnd)}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
                {formatCurrency(policy.premium, policy.currency)}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-200">
                <div className="flex flex-col">
                  <span>{policy.manager.name}</span>
                  {policy.manager.title ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500">{policy.manager.title}</span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${toneClasses[policyStatusLabels[policy.status].tone]}`}>
                  {policyStatusLabels[policy.status].label}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {!disableEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(policy)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-500 hover:text-sky-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500"
                  >
                    Продлить
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                )}
              </td>
            </tr>
          ))}
          {policies.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

interface ErrorBannerProps {
  title: string;
  description?: string;
  onRetry: () => void;
}

function ErrorBanner({ title, description, onRetry }: ErrorBannerProps) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{description ?? "Попробуйте повторить действие позже."}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-white px-3 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-200"
      >
        Повторить
      </button>
    </div>
  );
}

interface ActivitySectionProps {
  filter: ActivityFilter;
  onFilterChange: (filter: ActivityFilter) => void;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  data?: { items: ActivityLogEntry[]; total: number; page: number; pageSize: number };
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
}

function ActivitySection({
  filter,
  onFilterChange,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
  data,
  isLoading,
  isError,
  error,
  onRetry,
}: ActivitySectionProps) {
  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр активности">
          {activityTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onFilterChange(type)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                filter === type
                  ? "bg-sky-600 text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {activityTypeLabels[type]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
          Показать по
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </label>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Загрузка активности…</p> : null}
      {isError ? (
        <ErrorBanner title="Не удалось получить историю взаимодействий" description={(error as Error)?.message} onRetry={onRetry} />
      ) : null}

      {!isLoading && !isError ? (
        <div className="space-y-4">
          {(data?.items ?? []).map((entry) => (
            <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <header className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{entry.author}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{activityTypeLabels[entry.type]}</p>
                </div>
                <time className="text-xs text-slate-400" dateTime={entry.createdAt}>
                  {formatDate(entry.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </header>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">{entry.message}</p>
            </article>
          ))}
          {(data?.items ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">История пока пуста. Запишите первое взаимодействие.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-500 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500"
        >
          Назад
        </button>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Страница {data?.page ?? page} из {totalPages}
        </p>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-500 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500"
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}

interface TasksSectionProps {
  tasks?: ClientTaskChecklistItem[];
  reminders?: ClientReminderCalendarItem[];
  isTasksLoading: boolean;
  isTasksError: boolean;
  tasksError?: unknown;
  onRetryTasks: () => void;
  isRemindersLoading: boolean;
  isRemindersError: boolean;
  remindersError?: unknown;
  onRetryReminders: () => void;
  onToggleTask: (taskId: string, completed: boolean) => void;
  isTogglingTask: boolean;
}

function TasksSection({
  tasks,
  reminders,
  isTasksLoading,
  isTasksError,
  tasksError,
  onRetryTasks,
  isRemindersLoading,
  isRemindersError,
  remindersError,
  onRetryReminders,
  onToggleTask,
  isTogglingTask,
}: TasksSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <header>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Чек-лист задач</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">Отмечайте завершённые шаги прямо из карточки клиента.</p>
        </header>

        {isTasksLoading ? <p className="text-sm text-slate-500">Загрузка задач…</p> : null}
        {isTasksError ? (
          <ErrorBanner title="Не удалось загрузить задачи" description={(tasksError as Error)?.message} onRetry={onRetryTasks} />
        ) : null}

        {!isTasksLoading && !isTasksError ? (
          <ul className="space-y-3">
            {(tasks ?? []).map((task) => (
              <li key={task.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-sky-500 dark:border-slate-700">
                <input
                  id={`task-${task.id}`}
                  type="checkbox"
                  checked={task.completed}
                  onChange={(event) => onToggleTask(task.id, event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  disabled={isTogglingTask}
                />
                <label htmlFor={`task-${task.id}`} className="flex flex-1 flex-col gap-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{task.title}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {formatDate(task.dueDate)} • Ответственный: {task.owner}
                  </span>
                  {task.reminderAt ? (
                    <span className="text-xs text-sky-600 dark:text-sky-300">
                      Напоминание: {formatDate(task.reminderAt, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
            {(tasks ?? []).length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                Задач для клиента нет. Создайте задачу, чтобы зафиксировать следующий шаг.
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <header>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Календарь напоминаний</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">Контролируйте ключевые события и дедлайны.</p>
        </header>

        {isRemindersLoading ? <p className="text-sm text-slate-500">Загрузка напоминаний…</p> : null}
        {isRemindersError ? (
          <ErrorBanner
            title="Не удалось получить напоминания"
            description={(remindersError as Error)?.message}
            onRetry={onRetryReminders}
          />
        ) : null}

        {!isRemindersLoading && !isRemindersError ? (
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-200">
            {(reminders ?? []).map((reminder) => (
              <li key={reminder.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <p className="font-medium text-slate-700 dark:text-slate-100">{reminder.title}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {formatDate(reminder.occursAt, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {reminder.description ? <p className="mt-1 text-sm">{reminder.description}</p> : null}
              </li>
            ))}
            {(reminders ?? []).length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                Напоминаний нет. Запланируйте событие, чтобы не упустить важные даты.
              </li>
            ) : null}
          </ul>
        ) : null}
      </aside>
    </div>
  );
}

export function ClientWorkspace({ clientId }: ClientWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ email: "", phone: "" });
  const [contactErrors, setContactErrors] = useState({ email: "", phone: "" });
  const [policyModal, setPolicyModal] = useState<
    | { mode: "create"; policy?: undefined }
    | { mode: "edit"; policy: ClientPolicy }
    | null
  >(null);
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(initialPolicyForm());
  const emptyPolicyErrors = useMemo(
    () => ({ number: "", product: "", insurer: "", premium: "", currency: "", periodStart: "", periodEnd: "", status: "" }),
    [],
  );
  const [policyErrors, setPolicyErrors] = useState<Record<keyof PolicyFormState, string>>(emptyPolicyErrors);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(5);

  const {
    data: client,
    isLoading: isClientLoading,
    isError: isClientError,
    error: clientError,
    refetch: refetchClient,
  } = useClient(clientId);
  const activePoliciesQuery = useClientPolicies(clientId, { status: "active" });
  const archivedPoliciesQuery = useClientPolicies(clientId, { status: "archived" });
  const activityQuery = useClientActivity(clientId, {
    type: activityFilter,
    page: activityPage,
    pageSize: activityPageSize,
  });
  const tasksQuery = useClientTaskChecklist(clientId);
  const remindersQuery = useClientReminders(clientId);

  const updateContacts = useUpdateClientContacts(clientId);
  const createPolicy = useCreateClientPolicy(clientId);
  const updatePolicy = useUpdateClientPolicy(clientId);
  const toggleTask = useToggleClientChecklistTask(clientId);

  useEffect(() => {
    if (client) {
      setContactForm({ email: client.email, phone: client.phone });
    }
  }, [client]);

  useEffect(() => {
    if (!activityQuery.data) {
      return;
    }
    const maxPage = Math.max(1, Math.ceil(activityQuery.data.total / activityQuery.data.pageSize));
    if (activityPage > maxPage) {
      setActivityPage(maxPage);
    }
  }, [activityQuery.data, activityPage]);

  const handleExport = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  const openContactsModal = useCallback(() => {
    setContactsModalOpen(true);
    setContactErrors({ email: "", phone: "" });
  }, []);

  const closeContactsModal = useCallback(() => {
    setContactsModalOpen(false);
  }, []);

  const validateContacts = useCallback(() => {
    const errors = { email: "", phone: "" };
    if (!contactForm.email.trim()) {
      errors.email = "Укажите e-mail";
    } else if (!/^\S+@\S+\.\S+$/.test(contactForm.email.trim())) {
      errors.email = "Некорректный e-mail";
    }

    if (!contactForm.phone.trim()) {
      errors.phone = "Укажите телефон";
    }

    setContactErrors(errors);
    return !errors.email && !errors.phone;
  }, [contactForm.email, contactForm.phone]);

  const handleContactsSave = useCallback(async () => {
    if (!validateContacts()) {
      return;
    }

    try {
      await updateContacts.mutateAsync(
        sanitizeContactsPayload(client, {
          email: contactForm.email.trim(),
          phone: contactForm.phone.trim(),
        }),
      );
      closeContactsModal();
    } catch (error) {
      // Ошибка отображается в модальном окне.
    }
  }, [client, closeContactsModal, contactForm.email, contactForm.phone, updateContacts, validateContacts]);

  const openPolicyModal = useCallback((mode: "create" | "edit", policy?: ClientPolicy) => {
    setPolicyModal(mode === "create" ? { mode } : { mode: "edit", policy: policy! });
    setPolicyForm(initialPolicyForm(policy));
    setPolicyErrors(emptyPolicyErrors);
  }, [emptyPolicyErrors]);

  const closePolicyModal = useCallback(() => {
    setPolicyModal(null);
  }, []);

  const validatePolicyForm = useCallback(() => {
    const errors: Record<keyof PolicyFormState, string> = { ...emptyPolicyErrors };

    if (!policyForm.number.trim()) {
      errors.number = "Номер обязателен";
    }
    if (!policyForm.product.trim()) {
      errors.product = "Укажите продукт";
    }
    if (!policyForm.insurer.trim()) {
      errors.insurer = "Укажите страховщика";
    }
    const premium = Number.parseFloat(policyForm.premium.replace(/\s/g, ""));
    if (!Number.isFinite(premium) || premium <= 0) {
      errors.premium = "Премия должна быть положительной";
    }
    if (!policyForm.periodStart) {
      errors.periodStart = "Дата начала обязательна";
    }
    if (!policyForm.periodEnd) {
      errors.periodEnd = "Дата окончания обязательна";
    }
    if (policyForm.periodStart && policyForm.periodEnd && policyForm.periodEnd < policyForm.periodStart) {
      errors.periodEnd = "Дата окончания раньше даты начала";
    }

    setPolicyErrors(errors);
    return Object.values(errors).every((message) => message === "");
  }, [emptyPolicyErrors, policyForm]);

  const handlePolicySubmit = useCallback(async () => {
    if (!validatePolicyForm()) {
      return;
    }

    const payload: UpsertClientPolicyPayload = {
      number: policyForm.number.trim(),
      product: policyForm.product.trim(),
      insurer: policyForm.insurer.trim(),
      premium: Number.parseFloat(policyForm.premium.replace(/\s/g, "")),
      currency: policyForm.currency,
      periodStart: policyForm.periodStart,
      periodEnd: policyForm.periodEnd,
      status: policyForm.status,
    };

    try {
      if (policyModal?.mode === "edit" && policyModal.policy) {
        await updatePolicy.mutateAsync({ policyId: policyModal.policy.id, payload });
      } else {
        await createPolicy.mutateAsync(payload);
      }
      closePolicyModal();
    } catch (error) {
      // Ошибка отображается пользователю через состояние модалки.
    }
  }, [closePolicyModal, createPolicy, policyForm, policyModal, updatePolicy, validatePolicyForm]);

  const renderContent = () => {
    if (isClientLoading) {
      return <p className="text-sm text-slate-500">Загрузка данных клиента…</p>;
    }

    if (isClientError || !client) {
      return (
        <ErrorBanner
          title="Не удалось загрузить карточку клиента"
          description={(clientError as Error)?.message}
          onRetry={refetchClient}
        />
      );
    }

    switch (activeTab) {
      case "profile":
        return <ProfileSection client={client} onEditContacts={openContactsModal} />;
      case "policies":
        return (
          <PoliciesSection
            clientId={clientId}
            activePolicies={activePoliciesQuery.data}
            archivedPolicies={archivedPoliciesQuery.data}
            isActiveLoading={activePoliciesQuery.isLoading}
            isActiveError={activePoliciesQuery.isError}
            activeError={activePoliciesQuery.error}
            refetchActive={activePoliciesQuery.refetch}
            isArchivedLoading={archivedPoliciesQuery.isLoading}
            isArchivedError={archivedPoliciesQuery.isError}
            archivedError={archivedPoliciesQuery.error}
            refetchArchived={archivedPoliciesQuery.refetch}
            onCreatePolicy={() => openPolicyModal("create")}
            onEditPolicy={(policy) => openPolicyModal("edit", policy)}
          />
        );
      case "activity":
        return (
          <ActivitySection
            filter={activityFilter}
            onFilterChange={(value) => {
              setActivityFilter(value);
              setActivityPage(1);
            }}
            page={activityPage}
            onPageChange={setActivityPage}
            pageSize={activityPageSize}
            onPageSizeChange={(size) => {
              setActivityPageSize(size);
              setActivityPage(1);
            }}
            data={activityQuery.data}
            isLoading={activityQuery.isLoading}
            isError={activityQuery.isError}
            error={activityQuery.error}
            onRetry={activityQuery.refetch}
          />
        );
      case "tasks":
        return (
          <TasksSection
            tasks={tasksQuery.data}
            reminders={remindersQuery.data}
            isTasksLoading={tasksQuery.isLoading}
            isTasksError={tasksQuery.isError}
            tasksError={tasksQuery.error}
            onRetryTasks={tasksQuery.refetch}
            isRemindersLoading={remindersQuery.isLoading}
            isRemindersError={remindersQuery.isError}
            remindersError={remindersQuery.error}
            onRetryReminders={remindersQuery.refetch}
            onToggleTask={(taskId, completed) => toggleTask.mutate({ taskId, completed })}
            isTogglingTask={toggleTask.isPending}
          />
        );
      default:
        return null;
    }
  };

  const policyModalTitle = policyModal?.mode === "edit" ? "Редактирование полиса" : "Новый полис";
  const policyModalSubmitting = policyModal?.mode === "edit" ? updatePolicy.isPending : createPolicy.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{client?.name ?? "Карточка клиента"}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Единое пространство для профиля, полисов, активности и задач клиента.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-500 hover:text-sky-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500"
          >
            Экспорт в PDF
          </button>
        </div>
      </header>

      <nav role="tablist" aria-label="Вкладки карточки клиента" className="flex flex-wrap gap-3">
        {(
          [
            { key: "profile", label: "Профиль" },
            { key: "policies", label: "Полисы" },
            { key: "activity", label: "Активность" },
            { key: "tasks", label: "Задачи" },
          ] as Array<{ key: TabKey; label: string }>
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              activeTab === tab.key
                ? "bg-sky-600 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section aria-live="polite">{renderContent()}</section>

      <Modal
        isOpen={contactsModalOpen}
        onClose={closeContactsModal}
        title="Редактирование контактных данных"
        footer={
          <>
            <button
              type="button"
              onClick={closeContactsModal}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleContactsSave}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
              disabled={updateContacts.isPending}
            >
              Сохранить
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-200">E-mail</span>
            <input
              type="email"
              value={contactForm.email}
              onChange={(event) => setContactForm((form) => ({ ...form, email: event.target.value }))}
              className={`rounded-lg border px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                contactErrors.email ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
              placeholder="client@example.com"
            />
            {contactErrors.email ? <span className="text-xs text-rose-500">{contactErrors.email}</span> : null}
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-600 dark:text-slate-200">Телефон</span>
            <input
              type="tel"
              value={contactForm.phone}
              onChange={(event) => setContactForm((form) => ({ ...form, phone: event.target.value }))}
              className={`rounded-lg border px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                contactErrors.phone ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
              placeholder="+7 999 000-00-00"
            />
            {contactErrors.phone ? <span className="text-xs text-rose-500">{contactErrors.phone}</span> : null}
          </label>
          {updateContacts.isPending ? <p className="text-xs text-slate-500">Сохраняем контактные данные…</p> : null}
          {updateContacts.isError ? (
            <p className="text-xs text-rose-500">Не удалось сохранить контакты. Попробуйте ещё раз.</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={policyModal !== null}
        onClose={closePolicyModal}
        title={policyModalTitle}
        footer={
          <>
            <button
              type="button"
              onClick={closePolicyModal}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handlePolicySubmit}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
              disabled={policyModalSubmitting}
            >
              Сохранить
            </button>
          </>
        }
      >
        <div className="grid gap-4 text-sm text-slate-600 dark:text-slate-200 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Номер полиса</span>
            <input
              type="text"
              value={policyForm.number}
              onChange={(event) => setPolicyForm((form) => ({ ...form, number: event.target.value }))}
              className={`rounded-lg border px-3 py-2 focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                policyErrors.number ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
              placeholder="CR-2024-0001"
            />
            {policyErrors.number ? <span className="text-xs text-rose-500">{policyErrors.number}</span> : null}
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Продукт</span>
            <input
              type="text"
              value={policyForm.product}
              onChange={(event) => setPolicyForm((form) => ({ ...form, product: event.target.value }))}
              className={`rounded-lg border px-3 py-2 focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                policyErrors.product ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
              placeholder="ДМС"
            />
            {policyErrors.product ? <span className="text-xs text-rose-500">{policyErrors.product}</span> : null}
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Страховщик</span>
            <input
              type="text"
              value={policyForm.insurer}
              onChange={(event) => setPolicyForm((form) => ({ ...form, insurer: event.target.value }))}
              className={`rounded-lg border px-3 py-2 focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                policyErrors.insurer ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
              placeholder="Ингосстрах"
            />
            {policyErrors.insurer ? <span className="text-xs text-rose-500">{policyErrors.insurer}</span> : null}
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Премия</span>
            <input
              type="text"
              inputMode="decimal"
              value={policyForm.premium}
              onChange={(event) => setPolicyForm((form) => ({ ...form, premium: event.target.value }))}
              className={`rounded-lg border px-3 py-2 focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                policyErrors.premium ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
              placeholder="450000"
            />
            {policyErrors.premium ? <span className="text-xs text-rose-500">{policyErrors.premium}</span> : null}
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Валюта</span>
            <input
              type="text"
              value={policyForm.currency}
              onChange={(event) => setPolicyForm((form) => ({ ...form, currency: event.target.value.toUpperCase() }))}
              className={`rounded-lg border px-3 py-2 uppercase focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                policyErrors.currency ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
              maxLength={3}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Статус</span>
            <select
              value={policyForm.status}
              onChange={(event) => setPolicyForm((form) => ({ ...form, status: event.target.value as ClientPolicyStatus }))}
              className="rounded-lg border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            >
              {Object.entries(policyStatusLabels).map(([status, info]) => (
                <option key={status} value={status}>
                  {info.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Начало действия</span>
            <input
              type="date"
              value={policyForm.periodStart}
              onChange={(event) => setPolicyForm((form) => ({ ...form, periodStart: event.target.value }))}
              className={`rounded-lg border px-3 py-2 focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                policyErrors.periodStart ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
            />
            {policyErrors.periodStart ? <span className="text-xs text-rose-500">{policyErrors.periodStart}</span> : null}
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-300">Окончание действия</span>
            <input
              type="date"
              value={policyForm.periodEnd}
              onChange={(event) => setPolicyForm((form) => ({ ...form, periodEnd: event.target.value }))}
              className={`rounded-lg border px-3 py-2 focus:border-sky-500 focus:outline-none dark:bg-slate-900 ${
                policyErrors.periodEnd ? "border-rose-400" : "border-slate-200 dark:border-slate-700"
              }`}
            />
            {policyErrors.periodEnd ? <span className="text-xs text-rose-500">{policyErrors.periodEnd}</span> : null}
          </label>
        </div>
        {policyModalSubmitting ? <p className="text-xs text-slate-500">Сохраняем полис…</p> : null}
        {(createPolicy.isError || updatePolicy.isError) ? (
          <p className="text-xs text-rose-500">Не удалось сохранить полис. Проверьте данные и попробуйте ещё раз.</p>
        ) : null}
      </Modal>
    </div>
  );
}

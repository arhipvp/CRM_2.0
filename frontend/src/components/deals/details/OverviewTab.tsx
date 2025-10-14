"use client";

import { useState } from "react";
import type { DealDetailsData, DealPolicy } from "@/types/crm";

interface OverviewTabProps {
  deal: DealDetailsData;
  onOpenPolicies: () => void;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCurrency(value: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function CurrentPolicyCard({ policy, onOpenPolicies }: { policy: DealPolicy | undefined; onOpenPolicies: () => void }) {
  if (!policy) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
        Активный полис не выбран. Создайте или отметьте действующий полис на вкладке «Полисы».
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-200 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Текущий полис</h3>
          <p className="text-sm text-slate-500 dark:text-slate-300">{policy.product}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {policy.badges.map((badge) => (
            <span
              key={badge.id}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                badge.tone === "success"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                  : badge.tone === "warning"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                    : badge.tone === "danger"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
              }`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Номер</dt>
          <dd className="text-sm font-medium text-slate-900 dark:text-white">{policy.number}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Премия</dt>
          <dd className="text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(policy.premium, policy.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Период</dt>
          <dd className="text-sm font-medium text-slate-900 dark:text-white">
            {formatDate(policy.periodStart)} — {formatDate(policy.periodEnd)}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onOpenPolicies}
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-600 transition hover:text-sky-500"
      >
        Перейти к полисам →
      </button>
    </div>
  );
}

function LastInteractions({ deal }: { deal: DealDetailsData }) {
  const [expanded, setExpanded] = useState(false);
  const entries = expanded ? deal.overview.lastInteractions : deal.overview.lastInteractions.slice(0, 3);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Последние взаимодействия</h3>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-sm font-medium text-sky-600 transition hover:text-sky-500"
        >
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Нет недавних активностей. Запланируйте новое действие для клиента.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {formatDateTime(entry.occurredAt)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {entry.channel}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-300">{entry.excerpt ?? "Без дополнительного описания"}</p>
              <span className="text-xs text-slate-400 dark:text-slate-500">{entry.author}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConfirmedPayments({ deal }: { deal: DealDetailsData }) {
  if (deal.overview.confirmedPayments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
        Подтверждённых оплат пока нет. Как только платежи будут подтверждены, они появятся здесь.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Подтверждённые оплаты</h3>
      <ul className="space-y-3">
        {deal.overview.confirmedPayments.map((payment) => (
          <li key={payment.id} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(payment.amount, payment.currency)}
              </span>
              <span className="text-xs text-slate-500">
                {formatDate(payment.paidAtActual)}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Подтвердил(а): {payment.recordedBy.name}
              {payment.recordedBy.title ? ` · ${payment.recordedBy.title}` : ""}
            </span>
            {payment.comment ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">{payment.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OverviewTab({ deal, onOpenPolicies }: OverviewTabProps) {
  const currentPolicy = deal.policies.find((policy) => policy.id === deal.overview.currentPolicyId);
  const upcomingEvents = deal.overview.nextEvents;
  const warnings = deal.overview.warnings;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Ключевые показатели</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            {deal.overview.metrics.map((metric) => (
              <div key={metric.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</dt>
                <dd className={`text-xl font-semibold ${metric.accent === "danger" ? "text-rose-600" : metric.accent === "warning" ? "text-amber-600" : metric.accent === "success" ? "text-emerald-600" : "text-slate-900 dark:text-white"}`}>
                  {metric.value}
                </dd>
                {metric.hint ? <p className="text-xs text-slate-500">{metric.hint}</p> : null}
              </div>
            ))}
          </dl>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Следующие события</h4>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-slate-500">Запланируйте следующий шаг, чтобы не потерять контакт с клиентом.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {upcomingEvents.map((event) => (
                    <li key={event.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">{event.label}</span>
                        <span
                          className={`text-xs font-semibold ${
                            event.isOverdue
                              ? "text-rose-600"
                              : event.isSoon
                                ? "text-amber-600"
                                : "text-slate-500"
                          }`}
                        >
                          {formatDate(event.date)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Предупреждения</h4>
              {warnings.length === 0 ? (
                <p className="text-sm text-slate-500">Критичных предупреждений нет.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {warnings.map((warning) => (
                    <li
                      key={warning.id}
                      className={`rounded-lg border p-3 text-sm ${
                        warning.severity === "critical"
                          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200"
                          : warning.severity === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                      }`}
                    >
                      <p className="font-semibold">{warning.label}</p>
                      {warning.description ? <p className="text-xs">{warning.description}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
        <LastInteractions deal={deal} />
      </div>
      <div className="space-y-6">
        <CurrentPolicyCard policy={currentPolicy} onOpenPolicies={onOpenPolicies} />
        <ConfirmedPayments deal={deal} />
      </div>
    </div>
  );
}

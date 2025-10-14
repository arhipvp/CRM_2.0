"use client";

import { useState } from "react";
import type { DealPolicy, DealPolicyPayment } from "@/types/crm";

interface PoliciesTabProps {
  policies: DealPolicy[];
}

type PaymentFilter = "all" | "income" | "expense" | "overdue";

function formatDate(value: string | undefined) {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCurrency(value: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function PaymentRow({ payment, expanded, onToggle }: { payment: DealPolicyPayment; expanded: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Платёж #{payment.number}</span>
            {payment.tags.map((tag) => (
              <span
                key={tag.id}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  tag.tone === "success"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                    : tag.tone === "warning"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                      : tag.tone === "danger"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
                }`}
              >
                {tag.label}
              </span>
            ))}
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Статус: {payment.confirmationStatus}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(payment.amount, payment.currency)}</p>
          <p className="text-xs text-slate-500">План: {formatDate(payment.plannedDate)}</p>
          <p className="text-xs text-slate-500">Факт: {formatDate(payment.actualDate)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Ответственный: <span className="font-medium text-slate-700 dark:text-slate-200">{payment.responsible ?? "не назначен"}</span>
        </p>
        <button
          type="button"
          onClick={onToggle}
          className="text-sm font-medium text-sky-600 transition hover:text-sky-500"
        >
          {expanded ? "Свернуть детали" : "Раскрыть доходы и расходы"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Доходы</h4>
              {payment.incomes.length === 0 ? (
                <p className="text-xs text-slate-500">Доходных позиций нет.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payment.incomes.map((income) => (
                    <li key={income.id} className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-200">{income.title}</p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">
                        План: {formatCurrency(income.plannedAmount)} · Факт: {income.actualAmount ? formatCurrency(income.actualAmount) : "—"}
                      </p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">Статус: {income.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Расходы</h4>
              {payment.expenses.length === 0 ? (
                <p className="text-xs text-slate-500">Расходных позиций нет.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {payment.expenses.map((expense) => (
                    <li key={expense.id} className="rounded-lg border border-rose-200/60 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-900/10">
                      <p className="font-semibold text-rose-700 dark:text-rose-200">{expense.title}</p>
                      <p className="text-xs text-rose-700/80 dark:text-rose-200/80">
                        План: {formatCurrency(expense.plannedAmount)} · Факт: {expense.actualAmount ? formatCurrency(expense.actualAmount) : "—"}
                      </p>
                      <p className="text-xs text-rose-700/80 dark:text-rose-200/80">Статус: {expense.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Таймлайн согласований</h4>
            {payment.timeline.length === 0 ? (
              <p className="text-xs text-slate-500">История изменений ещё не зафиксирована.</p>
            ) : (
              <ol className="space-y-2 text-xs text-slate-500">
                {payment.timeline.map((event) => (
                  <li key={event.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{event.label}</p>
                    <p>
                      {formatDate(event.at)} · {event.user}
                    </p>
                    {event.comment ? <p className="text-slate-400">{event.comment}</p> : null}
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 flex gap-2 text-xs text-slate-500">
              <button type="button" className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500">
                Добавить доход
              </button>
              <button type="button" className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500">
                Добавить расход
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function filterPayments(payments: DealPolicyPayment[], filter: PaymentFilter): DealPolicyPayment[] {
  if (filter === "all") {
    return payments;
  }
  if (filter === "income") {
    return payments.filter((payment) => payment.incomes.length > 0);
  }
  if (filter === "expense") {
    return payments.filter((payment) => payment.expenses.length > 0);
  }
  return payments.filter((payment) => !payment.actualDate && new Date(payment.plannedDate).getTime() < Date.now());
}

export function PoliciesTab({ policies }: PoliciesTabProps) {
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [expandedPayments, setExpandedPayments] = useState<Record<string, boolean>>({});

  const togglePayment = (paymentId: string) => {
    setExpandedPayments((prev) => ({
      ...prev,
      [paymentId]: !prev[paymentId],
    }));
  };

  if (policies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
        Полисы ещё не созданы. Нажмите «Создать полис», чтобы начать оформление, или изучите инструкцию по запуску полисов.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {policies.map((policy) => {
        const payments = filterPayments(policy.payments, filter);

        return (
          <section key={policy.id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{policy.product}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-300">№ {policy.number}</p>
                <p className="text-xs text-slate-500">Период: {formatDate(policy.periodStart)} — {formatDate(policy.periodEnd)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Премия: {formatCurrency(policy.premium, policy.currency)}</p>
                <p className="text-xs text-slate-500">Ответственный: {policy.owner}</p>
              </div>
            </header>
            <div className="flex flex-wrap items-center gap-2">
              {policy.badges.map((badge) => (
                <span
                  key={badge.id}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    badge.tone === "success"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                      : badge.tone === "warning"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
                  }`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Фильтр по платежам:</span>
              {([{ id: "all", label: "Все" }, { id: "income", label: "С доходами" }, { id: "expense", label: "С расходами" }, { id: "overdue", label: "Просроченные" }] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      filter === item.id
                        ? "border-sky-600 bg-sky-50 text-sky-600 dark:border-sky-500 dark:bg-sky-900/20 dark:text-sky-200"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">Нет платежей, удовлетворяющих выбранному фильтру.</p>
            ) : (
              <ul className="space-y-3">
                {payments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    expanded={Boolean(expandedPayments[payment.id])}
                    onToggle={() => togglePayment(payment.id)}
                  />
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-sm">
              <button type="button" className="rounded border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Добавить платёж
              </button>
              <button type="button" className="rounded border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Создать полис
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

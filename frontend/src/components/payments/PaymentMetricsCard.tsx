"use client";

import React from "react";
import type { Payment } from "@/types/crm";
import type { PaymentStage } from "./PaymentTimeline";

interface PaymentMetricsCardProps {
  payment: Payment;
  currentStage: PaymentStage;
  onActionClick?: (actionType: string) => void;
  className?: string;
}

/**
 * Card component showing current payment stage metrics and quick actions
 * Displays stage info, status, key metrics, and action buttons
 */
export function PaymentMetricsCard({
  payment,
  currentStage,
  onActionClick,
  className = "",
}: PaymentMetricsCardProps): React.ReactElement {
  const statusConfig = getMetricsStatusConfig(currentStage.status);
  const isAwaitingStage = currentStage.id === "awaiting";

  // Determine available actions based on stage
  const actions = getAvailableActions(currentStage, payment);

  return (
    <article
      className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70 ${className}`}
    >
      {/* Header */}
      <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Stage Icon */}
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${statusConfig.bgClass}`}
              aria-hidden="true"
            >
              {statusConfig.icon}
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {currentStage.label}
              </h3>
              <p className={`text-xs font-medium ${statusConfig.textClass}`}>
                {statusConfig.label}
              </p>
            </div>
          </div>

          {/* Action Badge */}
          {currentStage.actionRequired && (
            <div
              className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
              role="alert"
            >
              <span>⚠️</span>
              <span>Требуется действие</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Metrics */}
      <div className="space-y-4 px-5 py-5">
        {/* Stage-Specific Information */}
        {isAwaitingStage && currentStage.daysUntilDue !== undefined && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Срок</p>

            {currentStage.isOverdue ? (
              <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-500/10">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
                  Просрочено на {Math.abs(currentStage.daysUntilDue)} дн.
                </p>
                {currentStage.dueDate && (
                  <p className="text-xs text-rose-600 dark:text-rose-300">
                    {formatDate(currentStage.dueDate)}
                  </p>
                )}
              </div>
            ) : (
              <div className={`rounded-lg p-3 ${
                currentStage.daysUntilDue <= 3
                  ? "bg-amber-50 dark:bg-amber-500/10"
                  : "bg-slate-50 dark:bg-slate-800"
              }`}>
                <p className={`text-sm font-semibold ${
                  currentStage.daysUntilDue <= 3
                    ? "text-amber-700 dark:text-amber-200"
                    : "text-slate-700 dark:text-slate-200"
                }`}>
                  До срока: {currentStage.daysUntilDue} дн.
                </p>
                {currentStage.dueDate && (
                  <p className={`text-xs ${
                    currentStage.daysUntilDue <= 3
                      ? "text-amber-600 dark:text-amber-300"
                      : "text-slate-600 dark:text-slate-400"
                  }`}>
                    {formatDate(currentStage.dueDate)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment Totals Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              План
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {formatCurrency(payment.plannedAmount ?? payment.amount, payment.currency)}
            </p>
          </div>

          <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Доходы
            </p>
            <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-200">
              {formatCurrency(payment.incomesTotal, payment.currency)}
            </p>
          </div>

          <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-500/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">
              Расходы
            </p>
            <p className="mt-1 text-sm font-bold text-rose-700 dark:text-rose-200">
              {formatCurrency(payment.expensesTotal, payment.currency)}
            </p>
          </div>

          <div
            className={`rounded-lg p-3 ${
              payment.netTotal >= 0
                ? "bg-emerald-50 dark:bg-emerald-500/10"
                : "bg-rose-50 dark:bg-rose-500/10"
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Netto
            </p>
            <p
              className={`mt-1 text-sm font-bold ${
                payment.netTotal >= 0
                  ? "text-emerald-700 dark:text-emerald-200"
                  : "text-rose-700 dark:text-rose-200"
              }`}
            >
              {formatCurrency(payment.netTotal, payment.currency)}
            </p>
          </div>
        </div>

        {/* Payment Confirmation Status */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Статус подтверждения
              </p>
              <p className={`mt-1 text-sm font-semibold ${
                payment.confirmationStatus === "confirmed"
                  ? "text-emerald-700 dark:text-emerald-200"
                  : "text-amber-700 dark:text-amber-200"
              }`}>
                {payment.confirmationStatus === "confirmed" ? "✓ Подтверждено" : "⏳ Ожидает подтверждения"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Доступные действия
            </p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onActionClick?.(action.id)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition ${action.className}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * Configuration for metrics card status display
 */
function getMetricsStatusConfig(status: "completed" | "waiting" | "pending" | "failed"): {
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
  label: string;
} {
  switch (status) {
    case "completed":
      return {
        icon: (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ),
        bgClass: "bg-emerald-500 dark:bg-emerald-600",
        textClass: "text-emerald-700 dark:text-emerald-200",
        label: "Завершено",
      };

    case "waiting":
      return {
        icon: (
          <svg className="h-6 w-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
          </svg>
        ),
        bgClass: "bg-amber-500 dark:bg-amber-600",
        textClass: "text-amber-700 dark:text-amber-200",
        label: "В процессе",
      };

    case "pending":
      return {
        icon: (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        ),
        bgClass: "bg-slate-400 dark:bg-slate-600",
        textClass: "text-slate-700 dark:text-slate-200",
        label: "Ожидает",
      };

    case "failed":
      return {
        icon: (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        ),
        bgClass: "bg-rose-500 dark:bg-rose-600",
        textClass: "text-rose-700 dark:text-rose-200",
        label: "Ошибка",
      };

    default:
      return {
        icon: "?",
        bgClass: "bg-slate-400 dark:bg-slate-600",
        textClass: "text-slate-700 dark:text-slate-200",
        label: "Неизвестно",
      };
  }
}

interface ActionButton {
  id: string;
  label: string;
  className: string;
}

/**
 * Get available actions based on current payment stage
 */
function getAvailableActions(currentStage: PaymentStage, payment: Payment): ActionButton[] {
  const actions: ActionButton[] = [];

  if (currentStage.id === "awaiting" && currentStage.status === "waiting") {
    actions.push({
      id: "record_payment",
      label: "Зафиксировать платёж",
      className:
        "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/20",
    });
  }

  if (payment.confirmationStatus !== "confirmed") {
    actions.push({
      id: "confirm_payment",
      label: "Подтвердить платёж",
      className:
        "border-sky-200 text-sky-600 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-200 dark:hover:bg-sky-500/20",
    });
  }

  if (currentStage.id === "received" && currentStage.status === "completed") {
    actions.push({
      id: "distribute_payment",
      label: "Распределить платёж",
      className:
        "border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500/60 dark:hover:text-sky-300",
    });
  }

  return actions;
}

/**
 * Format currency value
 */
function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ru-RU")} ${currency}`;
  }
}

/**
 * Format date value
 */
function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

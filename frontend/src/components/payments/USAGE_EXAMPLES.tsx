/**
 * PAYMENT TIMELINE COMPONENTS - USAGE EXAMPLES
 *
 * This file demonstrates how to use all Payment Timeline components
 * in real-world scenarios. Copy and adapt these examples for your use case.
 */

import React, { useState, useMemo } from "react";
import type { Payment } from "@/types/crm";
import {
  PaymentTimeline,
  PaymentTimelineStage,
  PaymentStatusIndicator,
  PaymentMetricsCard,
  type PaymentStage,
} from "./index";

/**
 * EXAMPLE 1: Full Payment Timeline with Metrics
 * Use this in a payment details page or modal
 */
export function PaymentDetailsView({ payment }: { payment: Payment }) {
  const stages = useMemo(() => calculateStagesHelper(payment), [payment]);
  const currentWaitingStage = stages.find((s) => s.status === "waiting");
  const currentStage = currentWaitingStage || stages[0];

  const handleStageClick = (stage: PaymentStage) => {
    console.log("Stage clicked:", stage.id, stage.status);
    // Open a detailed view or edit dialog for this stage
  };

  const handleMetricsAction = (actionType: string) => {
    console.log("Action triggered:", actionType);
    // Handle actions like record_payment, confirm_payment, etc.
  };

  return (
    <div className="space-y-6">
      {/* Main Timeline */}
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="sr-only">
          Временная шкала платежа
        </h2>
        <PaymentTimeline
          payment={payment}
          dealId={payment.dealId}
          onStageClick={handleStageClick}
        />
      </section>

      {/* Current Stage Metrics & Actions */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Метрики текущего этапа
        </h2>
        <PaymentMetricsCard
          payment={payment}
          currentStage={currentStage}
          onActionClick={handleMetricsAction}
        />
      </section>
    </div>
  );
}

/**
 * EXAMPLE 2: Compact Timeline in Table Row
 * Use this in payments table for quick status overview
 */
export function PaymentsTableRowExample({ payment }: { payment: Payment }) {
  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/40">
      {/* Policy Column */}
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {payment.policyNumber || "—"}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {payment.dealName || payment.dealId}
        </div>
      </td>

      {/* Status Column with Indicator */}
      <td className="px-4 py-3">
        <PaymentStatusIndicator payment={payment} size="sm" showLabels={true} />
      </td>

      {/* Amount Column */}
      <td className="px-4 py-3 text-right">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {formatCurrency(payment.plannedAmount ?? payment.amount, payment.currency)}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Netto: {formatCurrency(payment.netTotal, payment.currency)}
        </div>
      </td>

      {/* Confirmation Column */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
            payment.confirmationStatus === "confirmed"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
              : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
          }`}
        >
          {payment.confirmationStatus === "confirmed" ? "✓ Подтверждено" : "⏳ Ожидает"}
        </span>
      </td>

      {/* Actions Column */}
      <td className="px-4 py-3 text-right">
        <button className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-300">
          Подробнее
        </button>
      </td>
    </tr>
  );
}

/**
 * EXAMPLE 3: Payment Cards with Timeline
 * Use this to display multiple payments in a list view
 */
export function PaymentCardsListExample({ payments }: { payments: Payment[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {payments.map((payment) => (
        <article
          key={payment.id}
          className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
        >
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Полис {payment.policyNumber || "—"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {payment.dealName || payment.dealId}
              </p>
            </div>
            <PaymentStatusIndicator payment={payment} size="md" />
          </div>

          {/* Amounts */}
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">План:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(payment.plannedAmount ?? payment.amount, payment.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Netto:</span>
              <span
                className={`font-semibold ${
                  payment.netTotal >= 0
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {formatCurrency(payment.netTotal, payment.currency)}
              </span>
            </div>
          </div>

          {/* Compact Timeline */}
          <button className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-sky-600 transition hover:bg-sky-50 dark:border-slate-700 dark:text-sky-300 dark:hover:bg-slate-800">
            Просмотреть шкалу
          </button>
        </article>
      ))}
    </div>
  );
}

/**
 * EXAMPLE 4: Custom Timeline with Manual Stage Management
 * Use this if you need more control over stage rendering
 */
export function CustomTimelineView({ payment }: { payment: Payment }) {
  const stages = useMemo(() => calculateStagesHelper(payment), [payment]);
  const [activeStage, setActiveStage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Custom Timeline Render */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
        {/* Stages Row */}
        <div className="flex items-center justify-between gap-4">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.id}>
              {/* Stage */}
              <PaymentTimelineStage
                stage={stage}
                isActive={activeStage === stage.id}
                onClick={() => setActiveStage(stage.id)}
                showDetails={true}
              />

              {/* Connector */}
              {index < stages.length - 1 && (
                <div
                  className={`flex-grow max-w-[60px] h-1 rounded-full transition-colors ${
                    stage.status === "completed"
                      ? "bg-emerald-400 dark:bg-emerald-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Active Stage Details */}
        {activeStage && (
          <div className="mt-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/40">
            {stages
              .filter((s) => s.id === activeStage)
              .map((stage) => (
                <div key={stage.id} className="space-y-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {stage.label}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {stage.status === "completed" && "Этап завершён"}
                    {stage.status === "waiting" && "Этап в процессе"}
                    {stage.status === "pending" && "Этап ожидает"}
                    {stage.status === "failed" && "Ошибка на этапе"}
                  </p>
                  {stage.daysUntilDue !== undefined && (
                    <p className="text-sm font-medium">
                      {stage.isOverdue
                        ? `Просрочено на ${Math.abs(stage.daysUntilDue)} дн.`
                        : `${stage.daysUntilDue} дн до срока`}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * EXAMPLE 5: Dashboard Widget with Multiple Payments
 * Use this for a dashboard overview of recent payments
 */
export function PaymentsDashboardWidget({ payments }: { payments: Payment[] }) {
  const overduePayments = payments.filter((p) => {
    const dueDate = p.dueDate ?? p.plannedDate;
    if (!dueDate || p.status === "received" || p.status === "paid_out") return false;
    return new Date(dueDate).getTime() < Date.now();
  });

  const pendingPayments = payments.filter((p) => p.confirmationStatus !== "confirmed");

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/70">
      {/* Header */}
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Платежи</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Всего</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {payments.length}
          </p>
        </div>
        <div className="rounded-lg bg-rose-100 p-3 dark:bg-rose-500/10">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Просрочено</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-200">
            {overduePayments.length}
          </p>
        </div>
        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-500/10">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Не подтверждено
          </p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-200">
            {pendingPayments.length}
          </p>
        </div>
      </div>

      {/* Recent Payments List */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          Последние платежи
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {payments.slice(0, 5).map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {payment.policyNumber}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {payment.dealName}
                </p>
              </div>
              <PaymentStatusIndicator payment={payment} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * EXAMPLE 6: Payment with Modal Dialog
 * Use this when you need to show payment details in a modal
 */
export function PaymentModalExample({
  payment,
  isOpen,
  onClose,
}: {
  payment: Payment;
  isOpen: boolean;
  onClose: () => void;
}) {
  const stages = useMemo(() => calculateStagesHelper(payment), [payment]);
  const currentStage = stages.find((s) => s.status === "waiting") || stages[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-screen w-full max-w-2xl overflow-y-auto rounded-lg bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Платёж {payment.policyNumber}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Сделка: {payment.dealName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 px-6 py-6">
          {/* Timeline */}
          <PaymentTimeline payment={payment} dealId={payment.dealId} />

          {/* Metrics Card */}
          <PaymentMetricsCard
            payment={payment}
            currentStage={currentStage}
            onActionClick={(action) => {
              console.log("Action:", action);
              // Handle actions
            }}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * HELPER FUNCTIONS
 */

/**
 * Calculate payment stages (helper function for examples)
 * In real code, use the calculateStages function from PaymentTimeline
 */
function calculateStagesHelper(payment: Payment): PaymentStage[] {
  const now = new Date();
  const dueDate = payment.dueDate ?? payment.plannedDate;
  const dueDateObj = dueDate ? new Date(dueDate) : null;

  let daysUntilDue = 0;
  let isOverdue = false;
  if (dueDateObj && !Number.isNaN(dueDateObj.getTime())) {
    const diffTime = dueDateObj.getTime() - now.getTime();
    daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isOverdue = daysUntilDue < 0;
  }

  const stages: PaymentStage[] = [
    {
      id: "documents",
      label: "Документы",
      status: "completed",
      completedAt: payment.createdAt,
    },
    {
      id: "awaiting",
      label: "Ожидание",
      status: payment.status === "planned" || payment.status === "expected" ? "waiting" : "completed",
      dueDate: payment.dueDate ?? payment.plannedDate,
      daysUntilDue,
      isOverdue,
    },
    {
      id: "received",
      label: "Получен",
      status: payment.status === "received" || payment.status === "paid_out" ? "completed" : "pending",
      completedAt: payment.actualDate ?? payment.paidAt,
    },
    {
      id: "distributed",
      label: "Распределение",
      status: payment.status === "paid_out" ? "completed" : "pending",
      completedAt: payment.updatedAt,
    },
  ];

  return stages;
}

/**
 * Format currency value (helper function)
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

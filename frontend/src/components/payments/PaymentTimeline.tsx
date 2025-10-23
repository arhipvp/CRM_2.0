"use client";

import React, { useMemo } from "react";
import type { Payment, PaymentStatus } from "@/types/crm";
import { PaymentTimelineStage } from "./PaymentTimelineStage";

export type PaymentStageName = "documents" | "awaiting" | "received" | "distributed";

export interface PaymentStage {
  id: PaymentStageName;
  label: string;
  status: "completed" | "waiting" | "pending" | "failed";
  dueDate?: string;
  completedAt?: string;
  daysUntilDue?: number;
  isOverdue?: boolean;
  percentage?: number;
  actionRequired?: boolean;
}

interface PaymentTimelineProps {
  payment: Payment;
  dealId: string;
  onStageClick?: (stage: PaymentStage) => void;
}

/**
 * Calculates the payment timeline stages based on payment status and dates
 */
function calculateStages(payment: Payment): PaymentStage[] {
  const now = new Date();
  const dueDate = payment.dueDate ?? payment.plannedDate;
  const dueDateObj = dueDate ? new Date(dueDate) : null;

  // Calculate days until due
  let daysUntilDue = 0;
  let isOverdue = false;
  if (dueDateObj && !Number.isNaN(dueDateObj.getTime())) {
    const diffTime = dueDateObj.getTime() - now.getTime();
    daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isOverdue = daysUntilDue < 0;
  }

  // Stage 1: Documents
  const documentsStage: PaymentStage = {
    id: "documents",
    label: "Документы",
    status: "completed",
    completedAt: payment.createdAt,
    actionRequired: false,
  };

  // Stage 2: Awaiting (based on payment status being "planned" or "expected")
  const awaitingStatus =
    payment.status === "planned" || payment.status === "expected" ? "waiting" : "completed";
  const awaitingStage: PaymentStage = {
    id: "awaiting",
    label: "Ожидание",
    status: awaitingStatus,
    dueDate: payment.dueDate ?? payment.plannedDate,
    daysUntilDue,
    isOverdue,
    actionRequired:
      awaitingStatus === "waiting" &&
      (isOverdue || daysUntilDue < 3) &&
      daysUntilDue !== Number.POSITIVE_INFINITY,
  };

  // Stage 3: Received (based on payment status being "received" or "paid_out")
  const receivedStatus =
    payment.status === "received" || payment.status === "paid_out" ? "completed" : "pending";
  const receivedStage: PaymentStage = {
    id: "received",
    label: "Получен",
    status: receivedStatus,
    completedAt: payment.actualDate ?? payment.paidAt,
    actionRequired: false,
  };

  // Stage 4: Distributed (based on payment status being "paid_out")
  const distributedStatus = payment.status === "paid_out" ? "completed" : "pending";
  const distributedStage: PaymentStage = {
    id: "distributed",
    label: "Распределение",
    status: distributedStatus,
    completedAt: payment.updatedAt,
    actionRequired: false,
  };

  // Calculate percentage based on how many stages are completed
  const completedCount = [documentsStage, awaitingStage, receivedStage, distributedStage].filter(
    (s) => s.status === "completed",
  ).length;
  const percentage = (completedCount / 4) * 100;

  return [
    documentsStage,
    awaitingStage,
    receivedStage,
    { ...distributedStage, percentage },
  ];
}

export function PaymentTimeline({
  payment,
  onStageClick,
}: PaymentTimelineProps): React.ReactElement {
  const stages = useMemo(() => calculateStages(payment), [payment]);

  const handleStageClick = (stage: PaymentStage) => {
    onStageClick?.(stage);
  };

  return (
    <div className="space-y-4">
      {/* Timeline Container */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900/50">
        {/* Horizontal Timeline */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.id}>
              {/* Stage Component */}
              <PaymentTimelineStage
                stage={stage}
                isActive={false}
                onClick={() => handleStageClick(stage)}
              />

              {/* Connector Arrow (between stages) */}
              {index < stages.length - 1 && (
                <div
                  className={`flex-shrink-0 flex-grow max-w-[60px] h-1 rounded-full transition-colors ${
                    stages[index].status === "completed"
                      ? "bg-emerald-400 dark:bg-emerald-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current Stage Info */}
        <div className="mt-6 space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Текущий статус
            </h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Прогресс: {stages[stages.length - 1].percentage?.toFixed(0) ?? "0"}%
            </span>
          </div>

          {/* Current Stage Details */}
          {stages.map((stage) => {
            if (stage.status !== "waiting") return null;

            return (
              <div
                key={stage.id}
                className="space-y-2 rounded border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
              >
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {stage.label}
                </p>

                {stage.daysUntilDue !== undefined && (
                  <div className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
                    {stage.isOverdue ? (
                      <p className="font-medium text-rose-600 dark:text-rose-300">
                        Просрочено на {Math.abs(stage.daysUntilDue)} дн.
                      </p>
                    ) : (
                      <p>
                        Срок: <span className="font-semibold">{stage.daysUntilDue}</span> дн.
                        {stage.dueDate && (
                          <span className="ml-2 text-slate-600 dark:text-slate-400">
                            ({formatDate(stage.dueDate)})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {stage.actionRequired && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    ⚠️ Требуется действие
                  </p>
                )}
              </div>
            );
          })}

          {/* Completed Stage Details */}
          {stages.map((stage) => {
            if (stage.status !== "completed") return null;

            return (
              <div
                key={stage.id}
                className="space-y-1 rounded border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
              >
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {stage.label} ✓
                </p>
                {stage.completedAt && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-200">
                    {formatDate(stage.completedAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Information */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Плановая сумма</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {formatCurrency(payment.plannedAmount ?? payment.amount, payment.currency)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Статус платежа</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {formatPaymentStatus(payment.status)}
            </p>
          </div>

          <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Подтверждение</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                payment.confirmationStatus === "confirmed"
                  ? "text-emerald-600 dark:text-emerald-300"
                  : "text-amber-600 dark:text-amber-300"
              }`}
            >
              {payment.confirmationStatus === "confirmed" ? "Подтверждено" : "Ожидает подтверждения"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Чистый результат</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                payment.netTotal >= 0
                  ? "text-emerald-600 dark:text-emerald-300"
                  : "text-rose-600 dark:text-rose-300"
              }`}
            >
              {formatCurrency(payment.netTotal, payment.currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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

/**
 * Format payment status
 */
function formatPaymentStatus(status: PaymentStatus): string {
  const statusLabels: Record<PaymentStatus, string> = {
    planned: "Запланирован",
    expected: "Ожидается",
    received: "Получен",
    paid_out: "Выплачен",
    cancelled: "Отменён",
  };

  return statusLabels[status] ?? status;
}

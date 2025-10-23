"use client";

import React, { useMemo } from "react";
import type { Payment } from "@/types/crm";

interface PaymentStatusIndicatorProps {
  payment: Payment;
  size?: "sm" | "md";
  showLabels?: boolean;
}

/**
 * Compact timeline indicator for use in tables
 * Shows 4 small status boxes representing each payment stage
 */
export function PaymentStatusIndicator({
  payment,
  size = "sm",
  showLabels = false,
}: PaymentStatusIndicatorProps): React.ReactElement {
  // Calculate stage statuses
  const stages = useMemo(() => {
    return [
      {
        id: "documents",
        label: "Документы",
        status: "completed" as const,
      },
      {
        id: "awaiting",
        label: "Ожидание",
        status:
          payment.status === "planned" || payment.status === "expected"
            ? ("waiting" as const)
            : ("completed" as const),
      },
      {
        id: "received",
        label: "Получен",
        status:
          payment.status === "received" || payment.status === "paid_out"
            ? ("completed" as const)
            : ("pending" as const),
      },
      {
        id: "distributed",
        label: "Распределение",
        status: payment.status === "paid_out" ? ("completed" as const) : ("pending" as const),
      },
    ];
  }, [payment.status]);

  const sizeConfig = size === "sm" ? { boxSize: "w-5 h-5", iconSize: "h-3 w-3" } : { boxSize: "w-7 h-7", iconSize: "h-4 w-4" };

  return (
    <div className="flex items-center gap-2">
      {/* Status Boxes */}
      <div className="flex gap-1" aria-label="Статус платежа по этапам">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className={`flex items-center justify-center rounded border-2 font-bold transition-colors ${sizeConfig.boxSize} ${getStageClasses(
              stage.status,
            )}`}
            title={`${stage.label}: ${formatStageStatus(stage.status)}`}
            aria-label={`${stage.label}: ${formatStageStatus(stage.status)}`}
          >
            {getStageIcon(stage.status, sizeConfig.iconSize)}
          </div>
        ))}
      </div>

      {/* Optional Labels */}
      {showLabels && (
        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
          <span>Платёж</span>
          <span className="ml-1 font-semibold text-slate-900 dark:text-white">
            #{payment.sequence}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Get Tailwind classes for stage status
 */
function getStageClasses(status: "completed" | "waiting" | "pending" | "failed"): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500 border-emerald-600 text-white dark:bg-emerald-600 dark:border-emerald-700";
    case "waiting":
      return "bg-amber-400 border-amber-500 text-white dark:bg-amber-500 dark:border-amber-600";
    case "pending":
      return "bg-slate-200 border-slate-300 text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400";
    case "failed":
      return "bg-rose-500 border-rose-600 text-white dark:bg-rose-600 dark:border-rose-700";
    default:
      return "bg-slate-300 border-slate-400 text-slate-600";
  }
}

/**
 * Get SVG icon for stage status
 */
function getStageIcon(
  status: "completed" | "waiting" | "pending" | "failed",
  sizeClass: string,
): React.ReactNode {
  switch (status) {
    case "completed":
      return (
        <svg className={`${sizeClass} fill-current`} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );

    case "waiting":
      return (
        <svg className={`${sizeClass} fill-current animate-pulse`} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
        </svg>
      );

    case "pending":
      return (
        <div
          className={`${sizeClass} rounded-full border border-current`}
          aria-hidden="true"
        />
      );

    case "failed":
      return (
        <svg className={`${sizeClass} fill-current`} viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      );

    default:
      return "?";
  }
}

/**
 * Format stage status to human-readable text
 */
function formatStageStatus(status: "completed" | "waiting" | "pending" | "failed"): string {
  const labels: Record<typeof status, string> = {
    completed: "Завершено",
    waiting: "В процессе",
    pending: "Ожидает",
    failed: "Ошибка",
  };

  return labels[status] ?? "Неизвестно";
}

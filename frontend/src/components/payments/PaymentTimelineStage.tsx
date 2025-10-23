"use client";

import React from "react";
import type { PaymentStage } from "./PaymentTimeline";

interface PaymentTimelineStageProps {
  stage: PaymentStage;
  isActive?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
}

/**
 * Renders a single stage in the payment timeline
 * Shows status icon, label, and optional additional info
 */
export function PaymentTimelineStage({
  stage,
  isActive = false,
  onClick,
  showDetails = false,
}: PaymentTimelineStageProps): React.ReactElement {
  const statusConfig = getStatusConfig(stage.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${
        onClick ? "cursor-pointer hover:opacity-80" : ""
      } ${
        isActive
          ? "scale-110"
          : "scale-100"
      }`}
      aria-label={`${stage.label}: ${stage.status}`}
    >
      {/* Status Icon Circle */}
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold text-white shadow-sm transition-colors ${statusConfig.bgClass} ${statusConfig.borderClass}`}
        aria-hidden="true"
      >
        {statusConfig.icon}
      </div>

      {/* Stage Label */}
      <div className="text-center">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {stage.label}
        </p>

        {/* Additional Details */}
        {showDetails && (
          <div className="mt-1 space-y-0.5">
            {stage.daysUntilDue !== undefined && stage.status === "waiting" && (
              <p className={`text-[10px] font-medium ${
                stage.isOverdue
                  ? "text-rose-600 dark:text-rose-300"
                  : "text-amber-600 dark:text-amber-300"
              }`}>
                {stage.isOverdue
                  ? `Просрочено ${Math.abs(stage.daysUntilDue)} дн`
                  : `${stage.daysUntilDue} дн`}
              </p>
            )}

            {stage.actionRequired && stage.status === "waiting" && (
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-300">
                ⚠️ Действие
              </p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Configuration for different status types
 */
function getStatusConfig(
  status: "completed" | "waiting" | "pending" | "failed",
): {
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  textClass: string;
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
        borderClass: "border-emerald-600 dark:border-emerald-700",
        textClass: "text-emerald-600 dark:text-emerald-300",
      };

    case "waiting":
      return {
        icon: (
          <svg className="h-6 w-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zm1-9a1 1 0 11-2 0 1 1 0 012 0zm-1 4a1 1 0 100-2 1 1 0 000 2zm0 3a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
        ),
        bgClass: "bg-amber-400 dark:bg-amber-500",
        borderClass: "border-amber-500 dark:border-amber-600",
        textClass: "text-amber-600 dark:text-amber-300",
      };

    case "pending":
      return {
        icon: (
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-current" />
        ),
        bgClass: "bg-slate-300 dark:bg-slate-600",
        borderClass: "border-slate-400 dark:border-slate-700",
        textClass: "text-slate-500 dark:text-slate-400",
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
        borderClass: "border-rose-600 dark:border-rose-700",
        textClass: "text-rose-600 dark:text-rose-300",
      };

    default:
      return {
        icon: "?",
        bgClass: "bg-slate-400 dark:bg-slate-600",
        borderClass: "border-slate-500 dark:border-slate-700",
        textClass: "text-slate-500 dark:text-slate-400",
      };
  }
}

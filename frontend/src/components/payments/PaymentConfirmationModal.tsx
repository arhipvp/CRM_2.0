"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { Payment } from "@/types/crm";

interface PaymentConfirmationModalProps {
  payment: Payment;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    actualAmount: number;
    actualDate: string;
    recordedBy: string;
    recordedByRole?: string;
    comment?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("ru-RU")} ${currency}`;
  }
}

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

export function PaymentConfirmationModal({
  payment,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: PaymentConfirmationModalProps) {
  const [actualAmount, setActualAmount] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [recordedBy, setRecordedBy] = useState("");
  const [recordedByRole, setRecordedByRole] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialAmount = payment.actualAmount ?? payment.plannedAmount ?? payment.amount ?? "";
    const initialDate = payment.actualDate ?? new Date().toISOString();
    setActualAmount(String(initialAmount));
    setActualDate(initialDate ? initialDate.slice(0, 10) : "");
    setRecordedBy(payment.recordedBy ?? "");
    setRecordedByRole(payment.recordedByRole ?? "");
    setComment(payment.comment ?? "");
  }, [isOpen, payment]);

  const parsedAmount = useMemo(() => Number.parseFloat(actualAmount), [actualAmount]);
  const isValid = useMemo(() => {
    return (
      Number.isFinite(parsedAmount) &&
      parsedAmount > 0 &&
      Boolean(actualDate) &&
      Boolean(recordedBy.trim())
    );
  }, [actualDate, parsedAmount, recordedBy]);

  const plannedAmount = payment.plannedAmount ?? payment.amount;
  const targetStatus = payment.status === "paid_out" ? payment.status : "received";

  const amountDiff = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || plannedAmount === undefined) {
      return null;
    }

    const diff = parsedAmount - plannedAmount;
    if (diff === 0) {
      return null;
    }

    return `${diff > 0 ? "+" : "-"}${formatCurrency(Math.abs(diff), payment.currency)}`;
  }, [parsedAmount, plannedAmount, payment.currency]);

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }

    await onConfirm({
      actualAmount: parsedAmount,
      actualDate,
      recordedBy: recordedBy.trim(),
      recordedByRole: recordedByRole.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Подтверждение платежа"
      onClose={onClose}
      description="Укажите фактические данные, чтобы зафиксировать поступление."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Сохраняем..." : "Подтвердить"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Фактическая сумма</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={actualAmount}
              onChange={(event) => setActualAmount(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Фактическая дата</label>
            <input
              type="date"
              value={actualDate}
              onChange={(event) => setActualDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Подтверждающий</label>
            <input
              value={recordedBy}
              onChange={(event) => setRecordedBy(event.target.value)}
              placeholder="ФИО сотрудника"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Роль или должность</label>
            <input
              value={recordedByRole}
              onChange={(event) => setRecordedByRole(event.target.value)}
              placeholder="Например, Главный администратор"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Комментарий</label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={300}
            placeholder="Кратко опишите, откуда поступили средства"
            className="min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="text-xs text-slate-400">{comment.length}/300</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          <h4 className="text-xs font-semibold uppercase tracking-wide">Предпросмотр изменений</h4>
          <ul className="mt-2 space-y-1">
            <li>
              <span className="font-medium">Фактическая сумма:</span> {formatCurrency(plannedAmount, payment.currency)} →
              {" "}
              {Number.isFinite(parsedAmount) ? formatCurrency(parsedAmount, payment.currency) : "—"}
              {amountDiff ? ` (${amountDiff})` : ""}
            </li>
            <li>
              <span className="font-medium">Фактическая дата:</span> {formatDate(payment.actualDate)} → {formatDate(actualDate)}
            </li>
            <li>
              <span className="font-medium">Статус:</span> {payment.status} → {targetStatus}
            </li>
            <li>
              <span className="font-medium">Ответственный:</span> {payment.recordedBy ?? "—"} → {recordedBy.trim() || "—"}
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

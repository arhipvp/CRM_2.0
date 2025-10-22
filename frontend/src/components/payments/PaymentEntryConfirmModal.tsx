"use client";

import { useEffect, useMemo, useState, useId, type ChangeEvent } from "react";
import type { Payment, PaymentEntry } from "@/types/crm";
import { Modal } from "./Modal";
import { ADJUSTMENT_REASON_OPTIONS } from "./PaymentEntryFormModal";

export interface PaymentEntryConfirmValues {
  actualAmount: number;
  actualPostedAt: string;
  reason: string;
  note?: string;
  attachments: File[];
}

interface PaymentEntryConfirmModalProps {
  type: "income" | "expense";
  isOpen: boolean;
  entry?: PaymentEntry;
  payment?: Payment;
  currency: string;
  isSubmitting?: boolean;
  onSubmit: (values: PaymentEntryConfirmValues) => Promise<void>;
  onClose: () => void;
}

function formatCurrency(amount: number, currency: string) {
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

export function PaymentEntryConfirmModal({
  type,
  isOpen,
  entry,
  payment,
  currency,
  isSubmitting = false,
  onSubmit,
  onClose,
}: PaymentEntryConfirmModalProps) {
  const [actualAmount, setActualAmount] = useState("");
  const [actualPostedAt, setActualPostedAt] = useState("");
  const [reason, setReason] = useState("partial_payment");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const actualAmountId = useId();
  const actualDateId = useId();
  const reasonId = useId();
  const noteId = useId();
  const attachmentsId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (entry) {
      setActualAmount(entry.actualAmount != null ? String(entry.actualAmount) : "");
      setActualPostedAt(entry.actualPostedAt ? entry.actualPostedAt.slice(0, 10) : "");
      setReason(entry.adjustmentReason ?? "partial_payment");
      setNote(entry.note ?? "");
    } else {
      setActualAmount("");
      setActualPostedAt("");
      setReason("partial_payment");
      setNote("");
    }

    setAttachments([]);
  }, [entry, isOpen]);

  const plannedBaseline = entry ? entry.actualAmount ?? entry.plannedAmount ?? entry.amount : 0;

  const actualAmountValue = Number.parseFloat(actualAmount);
  const actualPostedAtDate = actualPostedAt ? new Date(actualPostedAt) : undefined;
  const plannedDate = entry?.postedAt ? new Date(entry.postedAt) : undefined;

  const isAmountValid = Number.isFinite(actualAmountValue) && actualAmountValue > 0;
  const isDateValid = Boolean(actualPostedAt) && (!plannedDate || !actualPostedAtDate || actualPostedAtDate >= plannedDate);
  const isReasonValid = Boolean(reason);
  const isValid = isAmountValid && isDateValid && isReasonValid;

  const diff = isAmountValid ? actualAmountValue - plannedBaseline : 0;

  const impact = useMemo(() => {
    if (!payment || !isAmountValid) {
      return null;
    }

    const currentContribution = plannedBaseline;
    const newActual = actualAmountValue;

    const incomesBaseline = payment.incomesTotal;
    const expensesBaseline = payment.expensesTotal;

    const updatedIncomesTotal =
      type === "income" ? incomesBaseline - currentContribution + newActual : incomesBaseline;
    const updatedExpensesTotal =
      type === "expense" ? expensesBaseline - currentContribution + newActual : expensesBaseline;
    const updatedNetTotal = updatedIncomesTotal - updatedExpensesTotal;

    return {
      incomes: {
        current: incomesBaseline,
        next: updatedIncomesTotal,
        delta: updatedIncomesTotal - incomesBaseline,
      },
      expenses: {
        current: expensesBaseline,
        next: updatedExpensesTotal,
        delta: updatedExpensesTotal - expensesBaseline,
      },
      net: {
        current: payment.netTotal,
        next: updatedNetTotal,
        delta: updatedNetTotal - payment.netTotal,
      },
    } as const;
  }, [actualAmountValue, isAmountValid, payment, plannedBaseline, type]);

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    setAttachments((previous) => [...previous, ...files]);
    event.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setAttachments((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }

    await onSubmit({
      actualAmount: actualAmountValue,
      actualPostedAt,
      reason,
      note: note.trim() || undefined,
      attachments,
    });
  };

  const title = type === "income" ? "Подтверждение поступления" : "Подтверждение расхода";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description="Укажите фактические данные и подтвердите изменения."
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
            {isSubmitting ? "Подтверждаем..." : "Подтвердить"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            htmlFor={actualAmountId}
          >
            Фактическая сумма *
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={actualAmount}
              onChange={(event) => setActualAmount(event.target.value)}
              id={actualAmountId}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-300">{currency}</span>
          </div>
          {!isAmountValid ? (
            <p className="text-xs text-rose-600">Укажите положительную сумму.</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            htmlFor={actualDateId}
          >
            Фактическая дата *
          </label>
          <input
            type="date"
            value={actualPostedAt}
            onChange={(event) => setActualPostedAt(event.target.value)}
            id={actualDateId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {!isDateValid ? (
            <p className="text-xs text-rose-600">Дата не может быть раньше плановой.</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            htmlFor={reasonId}
          >
            Причина *
          </label>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            id={reasonId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Выберите причину</option>
            {ADJUSTMENT_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {!isReasonValid ? <p className="text-xs text-rose-600">Выберите причину изменения.</p> : null}
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            htmlFor={noteId}
          >
            Комментарий
          </label>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Комментарий (до 300 символов)"
            id={noteId}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          htmlFor={attachmentsId}
        >
          Вложения
        </label>
        <input
          type="file"
          multiple
          onChange={handleFilesChange}
          id={attachmentsId}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:file:bg-slate-800 dark:file:text-slate-200"
        />
        {attachments.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-slate-200 p-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {attachments.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {file.name} • {(file.size / 1024).toFixed(1)} КБ
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(index)}
                  className="rounded border border-slate-300 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">Прикрепите документы, подтверждающие корректировку.</p>
        )}
      </div>
      {impact ? (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <p className="text-xs font-semibold uppercase tracking-wide">Влияние на агрегаты</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className="block text-[11px] uppercase text-emerald-600 dark:text-emerald-300">Доходы</span>
              <p className="text-sm font-medium">
                {formatCurrency(impact.incomes.next, currency)}
                <span className="ml-2 text-xs">
                  {impact.incomes.delta >= 0 ? "+" : ""}
                  {formatCurrency(impact.incomes.delta, currency)}
                </span>
              </p>
            </div>
            <div>
              <span className="block text-[11px] uppercase text-emerald-600 dark:text-emerald-300">Расходы</span>
              <p className="text-sm font-medium">
                {formatCurrency(impact.expenses.next, currency)}
                <span className="ml-2 text-xs">
                  {impact.expenses.delta >= 0 ? "+" : ""}
                  {formatCurrency(impact.expenses.delta, currency)}
                </span>
              </p>
            </div>
            <div>
              <span className="block text-[11px] uppercase text-emerald-600 dark:text-emerald-300">Netto</span>
              <p className="text-sm font-medium">
                {formatCurrency(impact.net.next, currency)}
                <span className="ml-2 text-xs">
                  {impact.net.delta >= 0 ? "+" : ""}
                  {formatCurrency(impact.net.delta, currency)}
                </span>
              </p>
            </div>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-200">
            Корректировка изменит вклад позиции на {diff >= 0 ? "+" : ""}
            {formatCurrency(diff, currency)}.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

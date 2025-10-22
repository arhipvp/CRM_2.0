"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Modal } from "./Modal";
import type { PaymentEntry } from "@/types/crm";

export interface PaymentEntryFormValues {
  category: string;
  plannedAmount: number;
  plannedPostedAt: string;
  note?: string;
  reason?: string;
  actualAmount?: number | null;
  actualPostedAt?: string | null;
  attachments: File[];
}

interface PaymentEntryFormModalProps {
  type: "income" | "expense";
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentEntryFormValues) => Promise<void>;
  isSubmitting?: boolean;
  currency: string;
  entry?: PaymentEntry;
}

const INCOME_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "client_payment", label: "Платёж клиента" },
  { value: "bonus", label: "Бонус" },
  { value: "advance", label: "Аванс" },
  { value: "other_income", label: "Прочее поступление" },
];

const EXPENSE_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "agent_fee", label: "Комиссия агента" },
  { value: "refund", label: "Возврат клиенту" },
  { value: "service_fee", label: "Сервисный сбор" },
  { value: "other_expense", label: "Прочий расход" },
];

export const ADJUSTMENT_REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "initial_planning", label: "Первичное планирование" },
  { value: "partial_payment", label: "Частичная оплата" },
  { value: "correction", label: "Корректировка суммы" },
  { value: "refund", label: "Возврат / перерасчёт" },
  { value: "other", label: "Другое" },
];

export function PaymentEntryFormModal({
  type,
  mode,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  currency,
  entry,
}: PaymentEntryFormModalProps) {
  const [plannedAmount, setPlannedAmount] = useState("");
  const [category, setCategory] = useState("");
  const [plannedPostedAt, setPlannedPostedAt] = useState("");
  const [note, setNote] = useState("");
  const [actualAmount, setActualAmount] = useState("");
  const [actualPostedAt, setActualPostedAt] = useState("");
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === "edit" && entry) {
      setPlannedAmount(String(entry.plannedAmount ?? entry.amount));
      setCategory(entry.category);
      setPlannedPostedAt(entry.postedAt.slice(0, 10));
      setNote(entry.note ?? "");
      setActualAmount(entry.actualAmount != null ? String(entry.actualAmount) : "");
      setActualPostedAt(entry.actualPostedAt ? entry.actualPostedAt.slice(0, 10) : "");
      setReason(entry.adjustmentReason ?? "");
      setAttachments([]);
      return;
    }

    setPlannedAmount("");
    setCategory(type === "income" ? INCOME_CATEGORIES[0]?.value ?? "" : EXPENSE_CATEGORIES[0]?.value ?? "");
    setPlannedPostedAt("");
    setNote("");
    setActualAmount("");
    setActualPostedAt("");
    setReason("");
    setAttachments([]);
  }, [entry, isOpen, mode, type]);

  const categoryOptions = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const requiresReason = mode === "edit";

  const isValid = useMemo(() => {
    const plannedAmountValue = Number.parseFloat(plannedAmount);
    const hasReason = !requiresReason || Boolean(reason);
    return plannedAmountValue > 0 && Boolean(category) && Boolean(plannedPostedAt) && hasReason;
  }, [category, plannedPostedAt, plannedAmount, reason, requiresReason]);

  const actualFieldsEnabled = entry?.status === "confirmed";

  const existingAttachments = entry?.attachments ?? [];

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    setAttachments((previous) => [...previous, ...files]);
    event.target.value = "";
  };

  const handleRemoveFile = (fileIndex: number) => {
    setAttachments((previous) => previous.filter((_, index) => index !== fileIndex));
  };

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }

    const plannedAmountValue = Number.parseFloat(plannedAmount);
    const actualAmountValue = Number.parseFloat(actualAmount);

    await onSubmit({
      category,
      plannedAmount: plannedAmountValue,
      plannedPostedAt,
      note: note.trim() || undefined,
      reason: reason || undefined,
      actualAmount: actualFieldsEnabled && actualAmount ? actualAmountValue : undefined,
      actualPostedAt: actualFieldsEnabled && actualPostedAt ? actualPostedAt : undefined,
      attachments,
    });
  };

  const title = mode === "edit" ? (type === "income" ? "Редактирование дохода" : "Редактирование расхода") : type === "income"
      ? "Новое поступление"
      : "Новый расход";

  const description =
    type === "income"
      ? "Укажите статью поступления, сумму и дату."
      : "Заполните статью расхода, сумму и дату фиксации.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
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
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Сохраняем..." : mode === "edit" ? "Сохранить" : type === "income" ? "Добавить доход" : "Добавить расход"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Категория</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Плановая дата</label>
          <input
            type="date"
            value={plannedPostedAt}
            onChange={(event) => setPlannedPostedAt(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Плановая сумма</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={plannedAmount}
              onChange={(event) => setPlannedAmount(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-300">{currency}</span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Комментарий</label>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Комментарий (до 300 символов)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Фактическая сумма</label>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualAmount}
                onChange={(event) => setActualAmount(event.target.value)}
                disabled={!actualFieldsEnabled}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
              />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-300">{currency}</span>
            </div>
            {!actualFieldsEnabled ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Доступно после подтверждения позиции.</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Фактическая дата</label>
          <input
            type="date"
            value={actualPostedAt}
            onChange={(event) => setActualPostedAt(event.target.value)}
            disabled={!actualFieldsEnabled}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800/60 dark:disabled:text-slate-500"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Причина изменения{requiresReason ? " *" : ""}
          </label>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Выберите причину</option>
            {ADJUSTMENT_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Новые вложения</label>
          <input
            type="file"
            multiple
            onChange={handleFilesChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:file:bg-slate-800 dark:file:text-slate-200"
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
            <p className="text-xs text-slate-500 dark:text-slate-400">Выберите файлы для добавления подтверждающих документов.</p>
          )}
        </div>
      </div>
      {existingAttachments.length > 0 ? (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Текущие вложения</p>
          <ul className="space-y-1">
            {existingAttachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {attachment.fileName} • {(attachment.fileSize / 1024).toFixed(1)} КБ
                </span>
                {attachment.uploadedAt ? (
                  <span className="text-[11px] text-slate-400">
                    Загружено {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(attachment.uploadedAt))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}

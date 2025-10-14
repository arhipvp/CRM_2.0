"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { PaymentEntry } from "@/types/crm";

interface PaymentEntryFormValues {
  amount: number;
  category: string;
  postedAt: string;
  note?: string;
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
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === "edit" && entry) {
      setAmount(String(entry.amount));
      setCategory(entry.category);
      setPostedAt(entry.postedAt.slice(0, 10));
      setNote(entry.note ?? "");
      return;
    }

    setAmount("");
    setCategory(type === "income" ? INCOME_CATEGORIES[0]?.value ?? "" : EXPENSE_CATEGORIES[0]?.value ?? "");
    setPostedAt("");
    setNote("");
  }, [entry, isOpen, mode, type]);

  const categoryOptions = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const isValid = useMemo(() => {
    return Number.parseFloat(amount) > 0 && Boolean(category) && Boolean(postedAt);
  }, [amount, category, postedAt]);

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }

    await onSubmit({
      amount: Number.parseFloat(amount),
      category,
      postedAt,
      note: note.trim() || undefined,
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
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Дата</label>
          <input
            type="date"
            value={postedAt}
            onChange={(event) => setPostedAt(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сумма</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
    </Modal>
  );
}

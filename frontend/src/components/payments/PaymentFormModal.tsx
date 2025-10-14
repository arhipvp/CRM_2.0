"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { Payment, PaymentStatus } from "@/types/crm";

interface SelectOption {
  value: string;
  label: string;
}

export interface PaymentFormValues {
  dealId: string;
  clientId: string;
  policyNumber: string;
  plannedDate: string;
  plannedAmount: number;
  currency: string;
  status: PaymentStatus;
  actualDate?: string;
  comment?: string;
  recordedBy?: string;
}

interface PaymentFormModalProps {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentFormValues) => Promise<void>;
  isSubmitting?: boolean;
  payment?: Payment;
  dealOptions: SelectOption[];
  clientOptions: SelectOption[];
}

const STATUS_OPTIONS: Array<{ value: PaymentStatus; label: string }> = [
  { value: "planned", label: "Запланирован" },
  { value: "expected", label: "Ожидается" },
  { value: "received", label: "Получен" },
  { value: "paid_out", label: "Выплачен" },
  { value: "cancelled", label: "Отменён" },
];

const CURRENCY_OPTIONS = [
  { value: "RUB", label: "RUB" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

export function PaymentFormModal({
  mode,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  payment,
  dealOptions,
  clientOptions,
}: PaymentFormModalProps) {
  const [dealId, setDealId] = useState("");
  const [clientId, setClientId] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [plannedAmount, setPlannedAmount] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [status, setStatus] = useState<PaymentStatus>("planned");
  const [actualDate, setActualDate] = useState("");
  const [comment, setComment] = useState("");
  const [recordedBy, setRecordedBy] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === "edit" && payment) {
      setDealId(payment.dealId);
      setClientId(payment.clientId);
      setPolicyNumber(payment.policyNumber ?? "");
      setPlannedDate(payment.plannedDate ?? payment.dueDate ?? "");
      setPlannedAmount(String(payment.plannedAmount ?? payment.amount ?? ""));
      setCurrency(payment.currency);
      setStatus(payment.status);
      setActualDate(payment.actualDate ?? payment.paidAt ?? "");
      setComment(payment.comment ?? "");
      setRecordedBy(payment.recordedBy ?? "");
      return;
    }

    const defaultDeal = dealOptions[0]?.value ?? "";
    const defaultClient = clientOptions[0]?.value ?? "";
    setDealId(defaultDeal);
    setClientId(defaultClient);
    setPolicyNumber("");
    setPlannedDate("");
    setPlannedAmount("");
    setCurrency("RUB");
    setStatus("planned");
    setActualDate("");
    setComment("");
    setRecordedBy("");
  }, [clientOptions, dealOptions, isOpen, mode, payment]);

  const isEdit = mode === "edit";

  const isValid = useMemo(() => {
    return Boolean(
      dealId.trim() &&
        clientId.trim() &&
        policyNumber.trim() &&
        plannedDate &&
        currency &&
        Number.parseFloat(plannedAmount) > 0,
    );
  }, [clientId, currency, dealId, plannedAmount, plannedDate, policyNumber]);

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }

    await onSubmit({
      dealId: dealId.trim(),
      clientId: clientId.trim(),
      policyNumber: policyNumber.trim(),
      plannedDate,
      plannedAmount: Number.parseFloat(plannedAmount),
      currency,
      status,
      actualDate: actualDate || undefined,
      comment: comment.trim() || undefined,
      recordedBy: recordedBy.trim() || undefined,
    });
  };

  const hasDealOptions = dealOptions.length > 0;
  const hasClientOptions = clientOptions.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      title={isEdit ? "Редактирование платежа" : "Новый платёж"}
      onClose={onClose}
      description={
        isEdit
          ? "Измените плановые параметры и комментарий. История доходов и расходов отображается в карточке."
          : "Заполните плановые реквизиты. Доходы и расходы можно добавить после сохранения."
      }
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
            {isSubmitting ? "Сохраняем..." : isEdit ? "Сохранить" : "Создать платёж"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сделка</label>
          {hasDealOptions ? (
            <select
              value={dealId}
              onChange={(event) => setDealId(event.target.value)}
              disabled={isEdit}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="" disabled>
                Выберите сделку
              </option>
              {dealOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={dealId}
              onChange={(event) => setDealId(event.target.value)}
              disabled={isEdit}
              placeholder="ID сделки"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Клиент</label>
          {hasClientOptions ? (
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={isEdit}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="" disabled>
                Выберите клиента
              </option>
              {clientOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={isEdit}
              placeholder="ID клиента"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Номер полиса</label>
          <input
            value={policyNumber}
            onChange={(event) => setPolicyNumber(event.target.value)}
            disabled={isEdit}
            placeholder="Например, CR-2024-0001"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Статус</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as PaymentStatus)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Плановая дата</label>
          <input
            type="date"
            value={plannedDate}
            onChange={(event) => setPlannedDate(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Фактическая дата</label>
          <input
            type="date"
            value={actualDate}
            onChange={(event) => setActualDate(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Плановая сумма</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={plannedAmount}
            onChange={(event) => setPlannedAmount(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Валюта</label>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Комментарий</label>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={500}
          className="min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Добавьте детали оплаты или условия расчёта"
        />
        <div className="text-xs text-slate-400">{comment.length}/500</div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ответственный за подтверждение</label>
        <input
          value={recordedBy}
          onChange={(event) => setRecordedBy(event.target.value)}
          placeholder="ФИО сотрудника"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
    </Modal>
  );
}

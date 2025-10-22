"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { Payment, PaymentChange, PaymentStatus } from "@/types/crm";

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
  recordedByRole?: string;
  changeReason?: string;
}

export interface PaymentEditContext {
  reason: string;
  onReasonChange: (value: string) => void;
  history: PaymentChange[];
  summary: {
    plannedAmount: number;
    actualAmount?: number;
    incomesTotal: number;
    expensesTotal: number;
    netTotal: number;
  };
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
  editContext?: PaymentEditContext;
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

function formatCurrency(value: number | undefined, currency: string) {
  if (value === undefined) {
    return "—";
  }

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

export function PaymentFormModal({
  mode,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  payment,
  dealOptions,
  clientOptions,
  editContext,
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
  const [recordedByRole, setRecordedByRole] = useState("");

  const originalCurrency = payment?.currency;

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
      setRecordedByRole(payment.recordedByRole ?? "");
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
    setRecordedByRole("");
  }, [clientOptions, dealOptions, isOpen, mode, payment]);

  const isEdit = mode === "edit";

  const summaryCurrency = originalCurrency ?? currency;
  const currencyChanged = Boolean(
    isEdit && originalCurrency && currency && originalCurrency !== currency,
  );

  const changeReason = editContext?.reason ?? "";
  const reasonError = useMemo(() => {
    if (!isEdit || !editContext) {
      return undefined;
    }

    const trimmed = changeReason.trim();
    if (!trimmed) {
      return "Укажите причину изменения";
    }

    if (trimmed.length < 10) {
      return "Причина должна содержать не менее 10 символов";
    }

    return undefined;
  }, [changeReason, editContext, isEdit]);

  const isValid = useMemo(() => {
    return Boolean(
      dealId.trim() &&
        clientId.trim() &&
        policyNumber.trim() &&
        plannedDate &&
        currency &&
        Number.parseFloat(plannedAmount) > 0 &&
        (!isEdit || !editContext || !reasonError),
    );
  }, [clientId, currency, dealId, editContext, plannedAmount, plannedDate, policyNumber, isEdit, reasonError]);

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
      recordedByRole: recordedByRole.trim() || undefined,
      changeReason: isEdit ? changeReason.trim() || undefined : undefined,
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
      {isEdit && editContext ? (
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Причина изменения</label>
          <textarea
            value={changeReason}
            onChange={(event) => editContext.onReasonChange(event.target.value)}
            maxLength={500}
            className={`min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:bg-slate-900 dark:text-slate-100 ${
              reasonError ? "border-rose-300 dark:border-rose-500/60" : "border-slate-300 dark:border-slate-700"
            }`}
            placeholder="Опишите, что изменилось и почему"
            aria-invalid={reasonError ? "true" : undefined}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={reasonError ? "text-rose-500 dark:text-rose-300" : "text-slate-400"}>
              {reasonError ?? "Укажите причину — комментарий попадёт в журнал"}
            </span>
            <span className="text-slate-400">{changeReason.length}/500</span>
          </div>
        </div>
      ) : null}
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ответственный за подтверждение</label>
        <input
          value={recordedBy}
          onChange={(event) => setRecordedBy(event.target.value)}
          placeholder="ФИО сотрудника"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Роль или должность</label>
        <input
          value={recordedByRole}
          onChange={(event) => setRecordedByRole(event.target.value)}
          placeholder="Например, Главный администратор"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
      {isEdit && editContext ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сводка доходов и расходов</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900/80">
                <span className="block text-xs text-slate-400">Плановая сумма</span>
                <span className="font-semibold text-slate-700 dark:text-slate-100">
                  {formatCurrency(editContext.summary.plannedAmount, summaryCurrency)}
                </span>
              </div>
              <div className="rounded-md bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900/80">
                <span className="block text-xs text-slate-400">Фактическая сумма</span>
                <span className="font-semibold text-slate-700 dark:text-slate-100">
                  {formatCurrency(editContext.summary.actualAmount, summaryCurrency)}
                </span>
              </div>
              <div className="rounded-md bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900/80">
                <span className="block text-xs text-slate-400">Доходы</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                  {formatCurrency(editContext.summary.incomesTotal, summaryCurrency)}
                </span>
              </div>
              <div className="rounded-md bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900/80">
                <span className="block text-xs text-slate-400">Расходы</span>
                <span className="font-semibold text-rose-600 dark:text-rose-300">
                  {formatCurrency(editContext.summary.expensesTotal, summaryCurrency)}
                </span>
              </div>
              <div className="rounded-md bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900/80 sm:col-span-2">
                <span className="block text-xs text-slate-400">Чистый результат</span>
                <span className={`font-semibold ${editContext.summary.netTotal >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                  {formatCurrency(editContext.summary.netTotal, summaryCurrency)}
                </span>
              </div>
            </div>
            {isEdit ? (
              <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                Сводка показана в валюте {summaryCurrency}
              </p>
            ) : null}
            {currencyChanged ? (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                Текущие значения сводки отображаются в исходной валюте {originalCurrency}. Новая валюта {currency} будет применена после сохранения.
              </div>
            ) : null}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">История версий</h4>
            {editContext.history.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Изменений пока не фиксировалось.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {editContext.history.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-100">{entry.changedBy}</span>
                      <span className="text-slate-400">{formatDate(entry.changedAt)}</span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{entry.reason}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide text-slate-400">Статус</span>
                        <span className="text-sm text-slate-600 dark:text-slate-200">{entry.snapshot.status}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide text-slate-400">Плановая дата</span>
                        <span className="text-sm text-slate-600 dark:text-slate-200">{formatDate(entry.snapshot.plannedDate)}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide text-slate-400">Плановая сумма</span>
                        <span className="text-sm text-slate-600 dark:text-slate-200">
                          {formatCurrency(entry.snapshot.plannedAmount, summaryCurrency)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide text-slate-400">Фактическая сумма</span>
                        <span className="text-sm text-slate-600 dark:text-slate-200">
                          {formatCurrency(entry.snapshot.actualAmount, summaryCurrency)}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="block text-[11px] uppercase tracking-wide text-slate-400">Фактическая дата</span>
                        <span className="text-sm text-slate-600 dark:text-slate-200">{formatDate(entry.snapshot.actualDate)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

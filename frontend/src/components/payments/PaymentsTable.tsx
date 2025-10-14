"use client";

import { useMemo, useState } from "react";
import {
  usePayments,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
  useCreatePaymentIncome,
  useUpdatePaymentIncome,
  useDeletePaymentIncome,
  useCreatePaymentExpense,
  useUpdatePaymentExpense,
  useDeletePaymentExpense,
} from "@/lib/api/hooks";
import type { Payment, PaymentEntry } from "@/types/crm";
import type { PaymentEntryPayload } from "@/lib/api/client";
import { PaymentCard } from "./PaymentCard";
import { PaymentFormModal, type PaymentFormValues } from "./PaymentFormModal";
import { PaymentEntryFormModal, type PaymentEntryFormValues } from "./PaymentEntryFormModal";
import { PaymentEntryConfirmModal, type PaymentEntryConfirmValues } from "./PaymentEntryConfirmModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { useUiStore } from "@/stores/uiStore";
import { createRandomId } from "@/lib/utils/id";

const FILTERS = [
  { value: "all", label: "Все" },
  { value: "incomes", label: "Доходы" },
  { value: "expenses", label: "Расходы" },
  { value: "overdue", label: "Просроченные" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

type DialogState =
  | { type: "createPayment" }
  | { type: "editPayment"; payment: Payment }
  | { type: "deletePayment"; payment: Payment }
  | { type: "createIncome"; payment: Payment }
  | { type: "editIncome"; payment: Payment; entry: PaymentEntry }
  | { type: "deleteIncome"; payment: Payment; entry: PaymentEntry }
  | { type: "createExpense"; payment: Payment }
  | { type: "editExpense"; payment: Payment; entry: PaymentEntry }
  | { type: "deleteExpense"; payment: Payment; entry: PaymentEntry }
  | { type: "confirmIncome"; payment: Payment; entry: PaymentEntry }
  | { type: "confirmExpense"; payment: Payment; entry: PaymentEntry }
  | null;

function isOverdue(payment: Payment) {
  if (payment.status === "received" || payment.status === "paid_out" || payment.status === "cancelled") {
    return false;
  }

  const planned = payment.plannedDate ?? payment.dueDate;
  if (!planned) {
    return false;
  }

  const plannedTime = new Date(planned).getTime();
  if (Number.isNaN(plannedTime)) {
    return false;
  }

  return plannedTime < Date.now();
}

function matchesFilter(payment: Payment, filter: FilterValue) {
  switch (filter) {
    case "incomes":
      return payment.incomesTotal > 0;
    case "expenses":
      return payment.expensesTotal > 0;
    case "overdue":
      return isOverdue(payment);
    default:
      return true;
  }
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesSearch(payment: Payment, search: string) {
  if (!search) {
    return true;
  }

  const haystack = [
    payment.policyNumber,
    payment.dealName,
    payment.dealId,
    payment.clientName,
    payment.clientId,
    payment.comment,
    ...payment.incomes.map((income) => income.category),
    ...payment.expenses.map((expense) => expense.category),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return haystack.some((value) => value.includes(search));
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString("ru-RU")} ${currency}`;
  }
}

function mapFilesToAttachmentPayload(files: File[]): PaymentEntryPayload["attachments"] {
  return files.map((file) => ({
    fileName: file.name,
    fileSize: file.size,
  }));
}

function buildEntryPayloadFromForm(values: PaymentEntryFormValues): PaymentEntryPayload {
  const payload: PaymentEntryPayload = {
    category: values.category,
    plannedAmount: values.plannedAmount,
    plannedPostedAt: values.plannedPostedAt,
  };

  if (values.note !== undefined) {
    payload.note = values.note;
  }
  if (values.reason) {
    payload.reason = values.reason;
  }
  if (values.actualAmount !== undefined && values.actualAmount !== null) {
    payload.actualAmount = values.actualAmount;
  }
  if (values.actualPostedAt) {
    payload.actualPostedAt = values.actualPostedAt;
  }
  if (values.attachments.length > 0) {
    payload.attachments = mapFilesToAttachmentPayload(values.attachments);
  }

  return payload;
}

function buildConfirmPayload(values: PaymentEntryConfirmValues, entry: PaymentEntry): PaymentEntryPayload {
  const payload: PaymentEntryPayload = {
    category: entry.category,
    plannedAmount: entry.plannedAmount,
    plannedPostedAt: entry.postedAt,
    actualAmount: values.actualAmount,
    actualPostedAt: values.actualPostedAt,
    reason: values.reason,
  };

  if (values.note !== undefined) {
    payload.note = values.note;
  }
  if (values.attachments.length > 0) {
    payload.attachments = mapFilesToAttachmentPayload(values.attachments);
  }

  return payload;
}

export function PaymentsTable() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);

  const pushNotification = useUiStore((state) => state.pushNotification);

  const notify = (message: string, type: "success" | "info" | "warning" | "error" = "success") => {
    pushNotification({
      id: createRandomId(),
      message,
      type,
      timestamp: new Date().toISOString(),
      source: "payments",
    });
  };

  const { data: payments = [], isLoading, isError, error } = usePayments({ include: ["incomes", "expenses"] });

  const {
    mutateAsync: createPayment,
    isPending: isCreatingPayment,
  } = useCreatePayment();
  const {
    mutateAsync: updatePayment,
    isPending: isUpdatingPayment,
  } = useUpdatePayment();
  const {
    mutateAsync: deletePayment,
    isPending: isDeletingPayment,
  } = useDeletePayment();
  const {
    mutateAsync: createIncome,
    isPending: isCreatingIncome,
  } = useCreatePaymentIncome();
  const {
    mutateAsync: updateIncome,
    isPending: isUpdatingIncome,
  } = useUpdatePaymentIncome();
  const {
    mutateAsync: deleteIncome,
    isPending: isDeletingIncome,
  } = useDeletePaymentIncome();
  const {
    mutateAsync: createExpense,
    isPending: isCreatingExpense,
  } = useCreatePaymentExpense();
  const {
    mutateAsync: updateExpense,
    isPending: isUpdatingExpense,
  } = useUpdatePaymentExpense();
  const {
    mutateAsync: deleteExpense,
    isPending: isDeletingExpense,
  } = useDeletePaymentExpense();

  const normalizedSearch = useMemo(() => normalizeSearch(search), [search]);

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [payments]);

  const visiblePayments = useMemo(() => {
    return sortedPayments.filter((payment) => matchesFilter(payment, filter) && matchesSearch(payment, normalizedSearch));
  }, [filter, normalizedSearch, sortedPayments]);

  const summary = useMemo(() => {
    return visiblePayments.reduce(
      (acc, payment) => {
        acc.planned += payment.plannedAmount ?? payment.amount;
        acc.incomes += payment.incomesTotal;
        acc.expenses += payment.expensesTotal;
        acc.net += payment.netTotal;
        return acc;
      },
      { planned: 0, incomes: 0, expenses: 0, net: 0 },
    );
  }, [visiblePayments]);

  const summaryCurrency = visiblePayments[0]?.currency ?? payments[0]?.currency ?? "RUB";

  const dealOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const payment of payments) {
      map.set(payment.dealId, payment.dealName ?? payment.dealId);
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [payments]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const payment of payments) {
      map.set(payment.clientId, payment.clientName ?? payment.clientId);
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [payments]);

  const toggleExpanded = (paymentId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) {
        next.delete(paymentId);
      } else {
        next.add(paymentId);
      }
      return next;
    });
  };

  const handlePaymentSubmit = async (values: PaymentFormValues, payment?: Payment) => {
    try {
      if (payment) {
        await updatePayment({
          paymentId: payment.id,
          payload: {
            plannedAmount: values.plannedAmount,
            plannedDate: values.plannedDate || null,
            currency: values.currency,
            status: values.status,
            actualDate: values.actualDate ?? null,
            comment: values.comment ?? null,
            recordedBy: values.recordedBy ?? null,
          },
        });
        notify("Платёж обновлён", "success");
      } else {
        const created = await createPayment({
          dealId: values.dealId,
          clientId: values.clientId,
          policyNumber: values.policyNumber,
          plannedDate: values.plannedDate,
          plannedAmount: values.plannedAmount,
          currency: values.currency,
          status: values.status,
          actualDate: values.actualDate,
          comment: values.comment,
          recordedBy: values.recordedBy,
        });
        notify("Платёж создан", "success");
        setExpanded((prev) => new Set(prev).add(created.id));
      }

      setDialog(null);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Не удалось сохранить платёж";
      notify(message, "error");
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    try {
      await deletePayment({ paymentId: payment.id, dealId: payment.dealId });
      notify("Платёж удалён", "success");
      setDialog(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Не удалось удалить платёж";
      notify(message, "error");
    }
  };

  const handleEntrySubmit = async (
    type: "income" | "expense",
    values: PaymentEntryFormValues,
    payment: Payment,
    entry?: PaymentEntry,
  ) => {
    try {
      const payload = buildEntryPayloadFromForm(values);

      if (type === "income") {
        if (entry) {
          await updateIncome({
            paymentId: payment.id,
            incomeId: entry.id,
            dealId: payment.dealId,
            payload,
          });
          notify("Поступление обновлено", "success");
        } else {
          await createIncome({ paymentId: payment.id, dealId: payment.dealId, payload });
          notify("Поступление добавлено", "success");
        }
      } else {
        if (entry) {
          await updateExpense({
            paymentId: payment.id,
            expenseId: entry.id,
            dealId: payment.dealId,
            payload,
          });
          notify("Расход обновлён", "success");
        } else {
          await createExpense({ paymentId: payment.id, dealId: payment.dealId, payload });
          notify("Расход добавлен", "success");
        }
      }

      setDialog(null);
      setExpanded((prev) => new Set(prev).add(payment.id));
    } catch (entryError) {
      const message = entryError instanceof Error ? entryError.message : "Не удалось сохранить позицию";
      notify(message, "error");
    }
  };

  const handleEntryConfirm = async (
    type: "income" | "expense",
    values: PaymentEntryConfirmValues,
    payment: Payment,
    entry: PaymentEntry,
  ) => {
    try {
      const payload = buildConfirmPayload(values, entry);

      if (type === "income") {
        await updateIncome({
          paymentId: payment.id,
          incomeId: entry.id,
          dealId: payment.dealId,
          payload,
        });
        notify("Поступление подтверждено", "success");
      } else {
        await updateExpense({
          paymentId: payment.id,
          expenseId: entry.id,
          dealId: payment.dealId,
          payload,
        });
        notify("Расход подтверждён", "success");
      }

      setDialog(null);
      setExpanded((prev) => new Set(prev).add(payment.id));
    } catch (entryError) {
      const message = entryError instanceof Error ? entryError.message : "Не удалось подтвердить позицию";
      notify(message, "error");
    }
  };

  const handleEntryDelete = async (type: "income" | "expense", payment: Payment, entry: PaymentEntry) => {
    try {
      if (type === "income") {
        await deleteIncome({ paymentId: payment.id, dealId: payment.dealId, incomeId: entry.id });
        notify("Поступление удалено", "success");
      } else {
        await deleteExpense({ paymentId: payment.id, dealId: payment.dealId, expenseId: entry.id });
        notify("Расход удалён", "success");
      }
      setDialog(null);
      setExpanded((prev) => new Set(prev).add(payment.id));
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Не удалось удалить позицию";
      notify(message, "error");
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Платежи</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Управляйте поступлениями и расходами, фильтруйте просроченные и создавайте новые записи.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-900">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  filter === item.value
                    ? "bg-sky-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по номеру или категории"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => setDialog({ type: "createPayment" })}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
            >
              Добавить платёж
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-200">
          Не удалось загрузить платежи: {error instanceof Error ? error.message : "неизвестная ошибка"}
        </div>
      ) : visiblePayments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          {payments.length === 0 ? (
            <p>Платежи ещё не созданы. Добавьте первый платёж, чтобы спланировать поступления.</p>
          ) : (
            <p>По текущим фильтрам записи не найдены. Попробуйте изменить условия поиска.</p>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDialog({ type: "createPayment" })}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
            >
              Добавить платёж
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              expanded={expanded.has(payment.id)}
              onToggle={() => toggleExpanded(payment.id)}
              onEdit={() => setDialog({ type: "editPayment", payment })}
              onDelete={() => setDialog({ type: "deletePayment", payment })}
              onAddIncome={() => setDialog({ type: "createIncome", payment })}
              onAddExpense={() => setDialog({ type: "createExpense", payment })}
              onEditIncome={(entry) => setDialog({ type: "editIncome", payment, entry })}
              onDeleteIncome={(entry) => setDialog({ type: "deleteIncome", payment, entry })}
              onConfirmIncome={(entry) => setDialog({ type: "confirmIncome", payment, entry })}
              onEditExpense={(entry) => setDialog({ type: "editExpense", payment, entry })}
              onDeleteExpense={(entry) => setDialog({ type: "deleteExpense", payment, entry })}
              onConfirmExpense={(entry) => setDialog({ type: "confirmExpense", payment, entry })}
            />
          ))}
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 sm:grid-cols-4">
        <div>
          <span className="text-xs uppercase text-slate-400">План</span>
          <p>{formatCurrency(summary.planned, summaryCurrency)}</p>
        </div>
        <div>
          <span className="text-xs uppercase text-slate-400">Доходы</span>
          <p className="text-emerald-600 dark:text-emerald-300">{formatCurrency(summary.incomes, summaryCurrency)}</p>
        </div>
        <div>
          <span className="text-xs uppercase text-slate-400">Расходы</span>
          <p className="text-rose-600 dark:text-rose-300">{formatCurrency(summary.expenses, summaryCurrency)}</p>
        </div>
        <div>
          <span className="text-xs uppercase text-slate-400">Netto</span>
          <p className={summary.net >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}>
            {formatCurrency(summary.net, summaryCurrency)}
          </p>
        </div>
      </div>

      <PaymentFormModal
        mode={dialog?.type === "editPayment" ? "edit" : "create"}
        isOpen={dialog?.type === "createPayment" || dialog?.type === "editPayment"}
        payment={dialog && dialog.type === "editPayment" ? dialog.payment : undefined}
        onClose={() => setDialog(null)}
        onSubmit={(values) => handlePaymentSubmit(values, dialog?.type === "editPayment" ? dialog.payment : undefined)}
        isSubmitting={dialog?.type === "editPayment" ? isUpdatingPayment : isCreatingPayment}
        dealOptions={dealOptions}
        clientOptions={clientOptions}
      />

      <PaymentEntryFormModal
        type={dialog?.type === "createExpense" || dialog?.type === "editExpense" || dialog?.type === "deleteExpense" ? "expense" : "income"}
        mode={dialog?.type === "editIncome" || dialog?.type === "editExpense" ? "edit" : "create"}
        isOpen={
          dialog?.type === "createIncome" ||
          dialog?.type === "editIncome" ||
          dialog?.type === "createExpense" ||
          dialog?.type === "editExpense"
        }
        entry={dialog && (dialog.type === "editIncome" || dialog.type === "editExpense") ? dialog.entry : undefined}
        onClose={() => setDialog(null)}
        onSubmit={(values) => {
          if (!dialog || (dialog.type !== "createIncome" && dialog.type !== "editIncome" && dialog.type !== "createExpense" && dialog.type !== "editExpense")) {
            return Promise.resolve();
          }
          const type = dialog.type === "createIncome" || dialog.type === "editIncome" ? "income" : "expense";
          return handleEntrySubmit(type, values, dialog.payment, dialog.type === "editIncome" || dialog.type === "editExpense" ? dialog.entry : undefined);
        }}
        isSubmitting={
          dialog?.type === "editIncome"
            ? isUpdatingIncome
            : dialog?.type === "editExpense"
            ? isUpdatingExpense
            : dialog?.type === "createIncome"
            ? isCreatingIncome
            : dialog?.type === "createExpense"
            ? isCreatingExpense
            : false
        }
        currency={dialog?.payment?.currency ?? "RUB"}
      />

      <PaymentEntryConfirmModal
        type={dialog?.type === "confirmExpense" ? "expense" : "income"}
        isOpen={dialog?.type === "confirmIncome" || dialog?.type === "confirmExpense"}
        entry={dialog && (dialog.type === "confirmIncome" || dialog.type === "confirmExpense") ? dialog.entry : undefined}
        payment={dialog && (dialog.type === "confirmIncome" || dialog.type === "confirmExpense") ? dialog.payment : undefined}
        currency={dialog?.payment?.currency ?? "RUB"}
        onClose={() => setDialog(null)}
        isSubmitting={
          dialog?.type === "confirmIncome"
            ? isUpdatingIncome
            : dialog?.type === "confirmExpense"
            ? isUpdatingExpense
            : false
        }
        onSubmit={(values) => {
          if (!dialog || (dialog.type !== "confirmIncome" && dialog.type !== "confirmExpense")) {
            return Promise.resolve();
          }
          const type = dialog.type === "confirmIncome" ? "income" : "expense";
          return handleEntryConfirm(type, values, dialog.payment, dialog.entry);
        }}
      />

      <ConfirmDialog
        isOpen={dialog?.type === "deletePayment"}
        title="Удалить платёж"
        description={dialog?.type === "deletePayment" ? `Платёж ${dialog.payment.policyNumber ?? dialog.payment.id} будет удалён вместе с доходами и расходами.` : undefined}
        confirmLabel="Удалить"
        isConfirming={isDeletingPayment}
        onConfirm={() => {
          if (dialog?.type === "deletePayment") {
            void handleDeletePayment(dialog.payment);
          }
        }}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        isOpen={dialog?.type === "deleteIncome" || dialog?.type === "deleteExpense"}
        title={dialog?.type === "deleteIncome" ? "Удалить поступление" : "Удалить расход"}
        description={
          dialog?.type === "deleteIncome" || dialog?.type === "deleteExpense"
            ? `Будет удалена позиция ${dialog.entry.category} на сумму ${formatCurrency(
                dialog.entry.amount,
                dialog.payment.currency,
              )}.`
            : undefined
        }
        confirmLabel="Удалить"
        isConfirming={dialog?.type === "deleteIncome" ? isDeletingIncome : isDeletingExpense}
        onConfirm={() => {
          if (!dialog) {
            return;
          }
          if (dialog.type === "deleteIncome") {
            void handleEntryDelete("income", dialog.payment, dialog.entry);
          } else if (dialog.type === "deleteExpense") {
            void handleEntryDelete("expense", dialog.payment, dialog.entry);
          }
        }}
        onCancel={() => setDialog(null)}
      />
    </section>
  );
}

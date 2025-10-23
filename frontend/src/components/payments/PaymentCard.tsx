"use client";

import type { Payment, PaymentEntry, PaymentStatus } from "@/types/crm";
import { ADJUSTMENT_REASON_OPTIONS } from "./PaymentEntryFormModal";
import { PaymentTimeline } from "./PaymentTimeline";
import { PaymentStatusIndicator } from "./PaymentStatusIndicator";

interface PaymentCardProps {
  payment: Payment;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddIncome: () => void;
  onAddExpense: () => void;
  onEditIncome: (income: PaymentEntry) => void;
  onDeleteIncome: (income: PaymentEntry) => void;
  onConfirmIncome: (income: PaymentEntry) => void;
  onEditExpense: (expense: PaymentEntry) => void;
  onDeleteExpense: (expense: PaymentEntry) => void;
  onConfirm: () => void;
  onRevokeConfirmation: () => void;
  isConfirming?: boolean;
  isRevoking?: boolean;
  onConfirmExpense: (expense: PaymentEntry) => void;
}

const STATUS_LABELS: Record<PaymentStatus, { label: string; className: string; ariaLabel: string }> = {
  planned: {
    label: "Запланирован",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
    ariaLabel: "Статус платежа: запланирован",
  },
  expected: {
    label: "Ожидается",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
    ariaLabel: "Статус платежа: ожидается",
  },
  received: {
    label: "Получен",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    ariaLabel: "Статус платежа: получен",
  },
  paid_out: {
    label: "Выплачен",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    ariaLabel: "Статус платежа: выплачен",
  },
  cancelled: {
    label: "Отменён",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
    ariaLabel: "Статус платежа: отменён",
  },
};

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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatFileSize(size: number | undefined) {
  if (typeof size !== "number" || Number.isNaN(size)) {
    return "—";
  }

  const units = ["Б", "КБ", "МБ", "ГБ"] as const;
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value < 10 && unitIndex > 0 ? 1 : 0;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

const ENTRY_STATUS_LABELS = {
  confirmed: {
    label: "Подтверждено",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  pending_confirmation: {
    label: "Ожидает подтверждения",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  },
  draft: {
    label: "Черновик",
    className: "bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
  },
} as const satisfies Record<PaymentEntry["status"], { label: string; className: string }>;

const REASON_LABELS = Object.fromEntries(ADJUSTMENT_REASON_OPTIONS.map((option) => [option.value, option.label]));

function EntriesList({
  entries,
  currency,
  title,
  emptyLabel,
  onEdit,
  onDelete,
  onConfirm,
  addLabel,
  onAdd,
}: {
  entries: PaymentEntry[];
  currency: string;
  title: string;
  emptyLabel: string;
  onEdit: (entry: PaymentEntry) => void;
  onDelete: (entry: PaymentEntry) => void;
  onConfirm: (entry: PaymentEntry) => void;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-sky-600 transition hover:bg-sky-50 dark:border-slate-700 dark:text-sky-300 dark:hover:border-sky-500/60 dark:hover:bg-slate-800"
        >
          {addLabel}
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="space-y-2 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500/60 dark:hover:bg-slate-800/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatCurrency(entry.actualAmount ?? entry.amount ?? entry.plannedAmount, entry.currency ?? currency)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    План: {formatCurrency(entry.plannedAmount ?? entry.amount, entry.currency ?? currency)} • {formatDate(entry.postedAt)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Факт: {entry.actualAmount != null ? formatCurrency(entry.actualAmount, entry.currency ?? currency) : "—"} • {formatDate(entry.actualPostedAt)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Категория: {entry.category}</span>
                  {entry.note ? (
                    <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.note}</span>
                  ) : null}
                  {entry.adjustmentReason ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Причина: {REASON_LABELS[entry.adjustmentReason] ?? entry.adjustmentReason}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ENTRY_STATUS_LABELS[entry.status]?.className ?? ENTRY_STATUS_LABELS.pending_confirmation.className}`}>
                    {ENTRY_STATUS_LABELS[entry.status]?.label ?? ENTRY_STATUS_LABELS.pending_confirmation.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.status !== "confirmed" ? (
                      <button
                        type="button"
                        onClick={() => onConfirm(entry)}
                        className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                      >
                        Подтвердить
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500/60 dark:hover:text-sky-300"
                      aria-label="Редактировать позицию"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/20"
                      aria-label="Удалить позицию"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
              {entry.attachments.length > 0 ? (
                <div className="rounded-md border border-slate-200 bg-white/70 p-2 text-xs dark:border-slate-600 dark:bg-slate-800/50">
                  <p className="font-semibold text-slate-600 dark:text-slate-200">Вложения</p>
                  <ul className="mt-1 space-y-1 text-slate-500 dark:text-slate-300">
                    {entry.attachments.map((attachment) => (
                      <li key={attachment.id} className="flex items-center justify-between gap-2">
                        {attachment.url ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-sky-600 hover:underline dark:text-sky-300"
                          >
                            {attachment.fileName}
                          </a>
                        ) : (
                          <span className="truncate">{attachment.fileName}</span>
                        )}
                        <span className="text-[11px] text-slate-400">{(attachment.fileSize / 1024).toFixed(1)} КБ</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {entry.history.length > 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-600 dark:bg-slate-800/40">
                  <p className="font-semibold text-slate-600 dark:text-slate-200">История корректировок</p>
                  <ul className="mt-1 space-y-1 text-slate-500 dark:text-slate-300">
                    {entry.history.map((historyItem) => (
                      <li key={historyItem.id} className="flex flex-col gap-0.5">
                        <span>
                          {formatDateTime(historyItem.changedAt)} • {historyItem.changedBy}
                        </span>
                        <span>
                        План {formatCurrency(historyItem.plannedAmount, entry.currency ?? currency)} → {historyItem.actualAmount != null ? formatCurrency(historyItem.actualAmount, entry.currency ?? currency) : "—"}
                        </span>
                        {historyItem.reason ? (
                          <span>Причина: {REASON_LABELS[historyItem.reason] ?? historyItem.reason}</span>
                        ) : null}
                        {historyItem.note ? <span>Комментарий: {historyItem.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PaymentCard({
  payment,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddIncome,
  onAddExpense,
  onEditIncome,
  onDeleteIncome,
  onConfirmIncome,
  onEditExpense,
  onDeleteExpense,
  onConfirm,
  onRevokeConfirmation,
  isConfirming = false,
  isRevoking = false,
  onConfirmExpense,
}: PaymentCardProps) {
  const status = STATUS_LABELS[payment.status] ?? STATUS_LABELS.planned;
  const netClass = payment.netTotal >= 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200";
  const isConfirmed = payment.confirmationStatus === "confirmed";
  const plannedTotal = payment.plannedAmount ?? payment.amount;
  const actualAmount = payment.actualAmount ?? (payment.confirmationStatus === "confirmed" ? payment.incomesTotal : undefined);
  const diffAmount = actualAmount !== undefined ? actualAmount - plannedTotal : undefined;
  const diffLabel =
    diffAmount !== undefined && diffAmount !== 0
      ? `${diffAmount > 0 ? "+" : "-"}${formatCurrency(Math.abs(diffAmount), payment.currency)}`
      : null;

  const combinedAttachments = [
    ...payment.incomes.map((entry) => ({ entry, type: "income" as const })),
    ...payment.expenses.map((entry) => ({ entry, type: "expense" as const })),
  ].flatMap(({ entry, type }) =>
    entry.attachments.map((attachment) => ({
      attachment,
      entry,
      type,
    })),
  );

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div className="space-y-1 flex-1">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">Полис {payment.policyNumber ?? "—"}</span>
            <span>Сделка: {payment.dealName ?? payment.dealId}</span>
            <span>Клиент: {payment.clientName ?? payment.clientId}</span>
          </div>
          <div className="mt-2">
            <PaymentStatusIndicator payment={payment} size="sm" showLabels={true} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Плановая дата: {formatDate(payment.plannedDate ?? payment.dueDate)}</span>
            <span>Фактическая дата: {formatDate(payment.actualDate ?? payment.paidAt)}</span>
            <span>Обновлено: {formatDate(payment.updatedAt)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Плановая сумма: {formatCurrency(plannedTotal, payment.currency)}</span>
            <span>
              Фактическая сумма: {actualAmount !== undefined ? formatCurrency(actualAmount, payment.currency) : "—"}
            </span>
            {diffLabel ? (
              <span
                className={
                  diffAmount && diffAmount > 0
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-rose-600 dark:text-rose-300"
                }
              >
                Δ {diffLabel}
              </span>
            ) : null}
          </div>
          {payment.comment ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{payment.comment}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
            aria-label={status.ariaLabel}
          >
            {status.label}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm font-semibold">
            <span className="text-slate-600 dark:text-slate-200">
              План: {formatCurrency(payment.plannedAmount ?? payment.amount, payment.currency)}
            </span>
            <span className="text-emerald-600 dark:text-emerald-300">
              Доходы: {formatCurrency(payment.incomesTotal, payment.currency)}
            </span>
            <span className="text-rose-600 dark:text-rose-300">
              Расходы: {formatCurrency(payment.expensesTotal, payment.currency)}
            </span>
            <span className={`rounded-full px-2 py-1 text-xs ${netClass}`} aria-label="Чистый результат">
              Netto: {formatCurrency(payment.netTotal, payment.currency)}
            </span>
          </div>
          {payment.recordedBy ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Подтвердил(а): <span className="font-medium text-slate-700 dark:text-slate-200">{payment.recordedBy}</span>
              {payment.recordedByRole ? ` · ${payment.recordedByRole}` : ""}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {isConfirmed ? (
              <button
                type="button"
                onClick={onRevokeConfirmation}
                disabled={isRevoking}
                className="rounded-md border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/20"
              >
                {isRevoking ? "Отменяем..." : "Отменить подтверждение"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirming}
                className="rounded-md border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              >
                {isConfirming ? "Подтверждаем..." : "Подтвердить"}
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500/60 dark:hover:text-sky-300"
            >
              Редактировать
            </button>
            {!isConfirmed ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/20"
              >
                Удалить
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggle}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500/60 dark:hover:text-sky-300"
              aria-expanded={expanded}
            >
              {expanded ? "Свернуть" : "Детали"}
            </button>
          </div>
        </div>
      </header>
      {expanded ? (
        <div className="space-y-6 px-6 py-6 text-sm text-slate-600 dark:text-slate-200">
          <PaymentTimeline payment={payment} dealId={payment.dealId} />
          <EntriesList
            entries={payment.incomes}
            currency={payment.currency}
            title="Поступления"
            emptyLabel="Поступления ещё не фиксировались."
            onAdd={onAddIncome}
            addLabel="Добавить поступление"
            onEdit={onEditIncome}
            onDelete={onDeleteIncome}
            onConfirm={onConfirmIncome}
          />
          <EntriesList
            entries={payment.expenses}
            currency={payment.currency}
            title="Расходы"
            emptyLabel="Расходы ещё не добавлены."
            onAdd={onAddExpense}
            addLabel="Добавить расход"
            onEdit={onEditExpense}
            onDelete={onDeleteExpense}
            onConfirm={onConfirmExpense}
          />
          <section className="space-y-3">
            <header className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">История изменений</h4>
            </header>
            {payment.history.length > 0 ? (
              <ol className="space-y-3">
                {payment.history.map((change) => (
                  <li
                    key={change.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-100">
                        {formatDateTime(change.changedAt)} • {change.changedBy}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{change.reason}</span>
                    </div>
                    <dl className="mt-2 grid gap-2 text-[11px] text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                      <div className="flex flex-col gap-0.5">
                        <dt className="font-semibold text-slate-600 dark:text-slate-300">Плановая сумма</dt>
                        <dd>{formatCurrency(change.snapshot.plannedAmount, payment.currency)}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="font-semibold text-slate-600 dark:text-slate-300">Фактическая сумма</dt>
                        <dd>
                          {change.snapshot.actualAmount != null
                            ? formatCurrency(change.snapshot.actualAmount, payment.currency)
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="font-semibold text-slate-600 dark:text-slate-300">Плановая дата</dt>
                        <dd>{formatDate(change.snapshot.plannedDate)}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="font-semibold text-slate-600 dark:text-slate-300">Фактическая дата</dt>
                        <dd>{formatDate(change.snapshot.actualDate)}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="font-semibold text-slate-600 dark:text-slate-300">Статус</dt>
                        <dd>{STATUS_LABELS[change.snapshot.status]?.label ?? change.snapshot.status}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                История изменений пока пуста.
              </p>
            )}
          </section>
          <section className="space-y-3">
            <header className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Связанные документы</h4>
            </header>
            {combinedAttachments.length > 0 ? (
              <ul className="space-y-2">
                {combinedAttachments.map(({ attachment, entry, type }) => {
                  const sourceLabel = type === "income" ? "Поступление" : "Расход";
                  return (
                    <li
                      key={`${entry.id}-${attachment.id}`}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="space-y-1">
                        {attachment.url ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate font-semibold text-sky-600 hover:underline dark:text-sky-300"
                          >
                            {attachment.fileName}
                          </a>
                        ) : (
                          <span className="block truncate font-semibold text-slate-700 dark:text-slate-100">
                            {attachment.fileName}
                          </span>
                        )}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateTime(attachment.uploadedAt)} • {attachment.uploadedBy}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Источник: {sourceLabel} • {entry.category}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                        {formatFileSize(attachment.fileSize)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Документы ещё не прикреплены.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </article>
  );
}

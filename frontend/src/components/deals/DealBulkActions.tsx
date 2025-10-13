"use client";

import { useMemo } from "react";

interface DealBulkActionsProps {
  selectedDealIds: string[];
  onAssignManager: () => void;
  onChangeStage: () => void;
  onAddTask: () => void;
  onDelete: () => void;
  onClearSelection?: () => void;
}

function getPluralForm(count: number, forms: [string, string, string]) {
  const mod100 = count % 100;
  if (mod100 > 10 && mod100 < 20) {
    return forms[2];
  }

  const mod10 = count % 10;

  if (mod10 === 1) {
    return forms[0];
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }

  return forms[2];
}

export function buildBulkActionNotificationMessage(actionLabel: string, dealIds: string[]) {
  const count = dealIds.length;
  const dealsWord = getPluralForm(count, ["сделка", "сделки", "сделок"]);
  const idsPreview = dealIds.slice(0, 3).join(", ");
  const remaining = count - 3;
  const idsPart = idsPreview
    ? ` (ID: ${idsPreview}${remaining > 0 ? ` и ещё ${remaining}` : ""})`
    : "";

  return `Запрошено действие «${actionLabel}» для ${count} ${dealsWord}${idsPart}. TODO: заменить на API-вызов.`;
}

export function DealBulkActions({
  selectedDealIds,
  onAssignManager,
  onChangeStage,
  onAddTask,
  onDelete,
  onClearSelection,
}: DealBulkActionsProps) {
  const count = selectedDealIds.length;
  const selectionLabel = useMemo(
    () => `${count} ${getPluralForm(count, ["карточка", "карточки", "карточек"])}`,
    [count],
  );

  if (count === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:px-6 lg:px-8">
      <div
        className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-sky-200/40 backdrop-blur-lg transition dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-sky-900/40"
        role="region"
        aria-live="polite"
        aria-label="Массовые действия со сделками"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
              {count}
            </span>
            <div className="leading-tight">
              <p>{selectionLabel} выбрано</p>
              <p className="text-xs font-normal text-slate-500 dark:text-slate-400">
                Выберите действие, чтобы применить его ко всем отмеченным сделкам.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAssignManager}
              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
            >
              Назначить менеджера
            </button>
            <button
              type="button"
              onClick={onChangeStage}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-slate-900"
            >
              Изменить этап
            </button>
            <button
              type="button"
              onClick={onAddTask}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-slate-900"
            >
              Добавить задачу
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-rose-500/50 dark:bg-slate-900 dark:text-rose-300 dark:hover:border-rose-400 dark:hover:bg-rose-500/10 dark:focus-visible:ring-rose-400 dark:focus-visible:ring-offset-slate-900"
            >
              Удалить
            </button>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="ml-auto inline-flex items-center justify-center rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-300 dark:hover:text-white dark:focus-visible:ring-slate-600 dark:focus-visible:ring-offset-slate-900"
              >
                Очистить выбор
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { getPluralForm };

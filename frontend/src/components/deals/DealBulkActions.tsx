"use client";

import { useMemo } from "react";

interface DealBulkActionsProps {
  selectedDealIds: string[];
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

export function DealBulkActions({
  selectedDealIds,
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

  const handleClose = () => {
    onClearSelection?.();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:px-6 lg:px-8">
      <div
        className="pointer-events-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-sky-200/40 backdrop-blur-lg transition dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-sky-900/40"
        role="region"
        aria-live="polite"
        aria-label="Массовые действия со сделками"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
              {count}
            </span>
            <div className="leading-tight">
              <p className="font-semibold text-slate-800 dark:text-white">Массовые действия в разработке</p>
              <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                {selectionLabel} выбрано. Реализация операций перенесена в релиз 1.1, поэтому панель пока служит заглушкой.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white dark:focus-visible:ring-slate-500 dark:focus-visible:ring-offset-slate-900"
            >
              Понятно
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { getPluralForm };

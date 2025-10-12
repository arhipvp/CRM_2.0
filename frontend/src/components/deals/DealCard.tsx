"use client";

import Link from "next/link";
import { KeyboardEvent } from "react";

import { Deal } from "@/types/crm";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatProbability(probability: number) {
  return `${Math.round(probability * 100)}%`;
}

export interface DealCardProps {
  deal: Deal;
  highlighted?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onOpenPreview?: () => void;
  isDragging?: boolean;
  showCheckbox?: boolean;
}

export function DealCard({
  deal,
  highlighted,
  selected = false,
  onToggleSelect,
  onOpenPreview,
  isDragging = false,
  showCheckbox = true,
}: DealCardProps) {
  const isOverdue = deal.expectedCloseDate ? new Date(deal.expectedCloseDate).getTime() < Date.now() : false;

  const handleClick = () => {
    if (isDragging) {
      return;
    }

    onOpenPreview?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  const checkbox = showCheckbox ? (
    <input
      type="checkbox"
      className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      checked={selected}
      onChange={(event) => {
        event.stopPropagation();
        onToggleSelect?.();
      }}
      onClick={(event) => event.stopPropagation()}
      aria-label="Выбрать сделку для массовых действий"
    />
  ) : null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={classNames(
        "group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/80 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900/70",
        highlighted && "ring-2 ring-amber-400",
        selected && "ring-2 ring-sky-400",
        isOverdue && "border-amber-400 bg-amber-50/80 dark:border-amber-500/70 dark:bg-amber-900/20",
        isDragging && "opacity-80",
      )}
      aria-pressed={selected}
      aria-label={`Сделка ${deal.name} для клиента ${deal.clientName} на сумму ${formatCurrency(deal.value)}`}
    >
      <div className="flex items-start gap-3">
        {checkbox}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 transition group-hover:text-slate-900 dark:text-slate-100 dark:group-hover:text-white">
              {deal.name}
            </p>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {formatProbability(deal.probability)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-300">{deal.clientName}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-300">
        <span>{formatCurrency(deal.value)}</span>
        {deal.expectedCloseDate && (
          <span
            className={classNames(
              "text-xs",
              isOverdue ? "font-semibold text-amber-600 dark:text-amber-300" : "text-slate-400 dark:text-slate-500",
            )}
            title="Ожидаемая дата закрытия"
          >
            {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(deal.expectedCloseDate))}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>Ответственный: {deal.owner}</span>
        <Link
          href={`/deals/${deal.id}`}
          className="text-sky-600 underline-offset-2 transition hover:text-sky-500 hover:underline dark:text-sky-300"
          onClick={(event) => event.stopPropagation()}
        >
          Открыть
        </Link>
      </div>
    </article>
  );
}

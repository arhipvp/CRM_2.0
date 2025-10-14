"use client";

import Link from "next/link";
import type { DealDetailsData, DealQuickTag, DealRiskTag } from "@/types/crm";

const STAGE_LABELS: Record<DealDetailsData["stage"], string> = {
  qualification: "Квалификация",
  negotiation: "Переговоры",
  proposal: "Предложение",
  closedWon: "Закрыта (успех)",
  closedLost: "Закрыта (неуспех)",
};

function RiskBadge({ tag }: { tag: DealRiskTag }) {
  const toneClass = {
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200",
    critical: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200",
  }[tag.tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}
      title={tag.description}
    >
      {tag.label}
    </span>
  );
}

function QuickTag({ tag }: { tag: DealQuickTag }) {
  const toneClass =
    {
      neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
      info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
      success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
      warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
      danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
    }[tag.tone ?? "neutral"] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {tag.label}
    </span>
  );
}

function PriorityBadge({ level, label, reason }: DealDetailsData["priorityTag"] & { label: string }) {
  const toneClass =
    {
      low: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
      normal: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
      high: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-200",
      urgent: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
    }[level] ?? "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`} title={reason}>
      {label}
    </span>
  );
}

export interface DealDetailsHeaderProps {
  deal: DealDetailsData;
}

export function DealDetailsHeader({ deal }: DealDetailsHeaderProps) {
  return (
    <header className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-1 items-start gap-4">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border border-slate-200 shadow-sm dark:border-slate-700">
            {deal.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={deal.avatarUrl} alt={deal.clientName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-lg font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {deal.clientName.slice(0, 1)}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{deal.name}</h1>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {STAGE_LABELS[deal.stage]}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Клиент:{" "}
              <Link href={`/clients/${deal.clientId}`} className="font-medium text-sky-600 transition hover:text-sky-500">
                {deal.clientName}
              </Link>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {deal.riskTags.map((tag) => (
                <RiskBadge key={tag.id} tag={tag} />
              ))}
              {deal.priorityTag ? (
                <PriorityBadge level={deal.priorityTag.level} label={deal.priorityTag.label} reason={deal.priorityTag.reason} />
              ) : null}
            </div>
            {deal.quickTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {deal.quickTags.map((tag) => (
                  <QuickTag key={tag.id} tag={tag} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm text-slate-500 dark:text-slate-300 md:items-end">
          <span>
            Обновлено: {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(deal.updatedAt))}
          </span>
          <span>
            Ответственный: <span className="font-medium text-slate-700 dark:text-slate-100">{deal.owner || "—"}</span>
          </span>
        </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Сумма сделки</dt>
          <dd className="text-lg font-semibold text-slate-900 dark:text-white">
            {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(deal.value)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Вероятность</dt>
          <dd className="text-lg font-semibold text-slate-900 dark:text-white">{Math.round(deal.probability * 100)}%</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ожидаемое закрытие</dt>
          <dd className="text-lg font-semibold text-slate-900 dark:text-white">
            {deal.expectedCloseDate
              ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(deal.expectedCloseDate))
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Следующий просмотр</dt>
          <dd
            className={`text-lg font-semibold ${
              new Date(deal.nextReviewAt).getTime() < Date.now()
                ? "text-rose-600 dark:text-rose-300"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(deal.nextReviewAt))}
          </dd>
        </div>
      </dl>
    </header>
  );
}

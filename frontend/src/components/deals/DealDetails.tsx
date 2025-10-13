"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  dealQueryOptions,
} from "@/lib/api/queries";
import { useDeal, useUpdateDeal } from "@/lib/api/hooks";
import type { DealStage } from "@/types/crm";
import { DealActivity } from "@/components/deals/DealActivity";
import { DealDocuments } from "@/components/deals/DealDocuments";
import { DealFinance } from "@/components/deals/DealFinance";
import { DealTasks } from "@/components/deals/DealTasks";
import { useUiStore } from "@/stores/uiStore";

const STAGE_LABELS: Record<DealStage, string> = {
  qualification: "Квалификация",
  negotiation: "Переговоры",
  proposal: "Предложение",
  closedWon: "Закрыта (успех)",
  closedLost: "Закрыта (неуспех)",
};

type DealDetailsTab = "activity" | "tasks" | "documents" | "finance";

type TabConfig = {
  id: DealDetailsTab;
  title: string;
};

const TABS: TabConfig[] = [
  { id: "activity", title: "Журнал" },
  { id: "tasks", title: "Задачи" },
  { id: "documents", title: "Документы" },
  { id: "finance", title: "Финансы" },
];

const DEAL_STAGE_METRICS_QUERY_KEY = ["deal-stage-metrics"] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function toDateInput(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function DealDetails({ dealId }: { dealId: string }) {
  const { data: deal, isLoading } = useDeal(dealId);
  const { mutateAsync: updateDeal, isPending: isSaving } = useUpdateDeal(dealId);
  const queryClient = useQueryClient();
  const markDealUpdated = useUiStore((state) => state.markDealUpdated);
  const dealUpdateToken = useUiStore((state) => state.dealUpdates[dealId]);
  const clearDealUpdate = useUiStore((state) => state.clearDealUpdate);

  const [activeTab, setActiveTab] = useState<DealDetailsTab>("activity");
  const [taskRequestKey, setTaskRequestKey] = useState<string>();
  const [noteRequestKey, setNoteRequestKey] = useState<string>();
  const [documentRequestKey, setDocumentRequestKey] = useState<string>();

  const [stage, setStage] = useState<DealStage>("qualification");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState(50);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [owner, setOwner] = useState("");
  const [isHighlighted, setIsHighlighted] = useState(false);

  const dealKey = useMemo(() => dealQueryOptions(dealId).queryKey, [dealId]);

  useEffect(() => {
    if (!deal) {
      return;
    }

    setStage(deal.stage);
    setValue(String(deal.value));
    setProbability(Math.round(deal.probability * 100));
    setExpectedCloseDate(toDateInput(deal.expectedCloseDate));
    setNextReviewDate(toDateInput(deal.nextReviewAt));
    setOwner(deal.owner ?? "");
  }, [deal]);

  useEffect(() => {
    if (!dealUpdateToken) {
      return;
    }

    setIsHighlighted(true);
    const timeoutId = window.setTimeout(() => {
      setIsHighlighted(false);
      clearDealUpdate(dealId);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [clearDealUpdate, dealId, dealUpdateToken]);

  if (isLoading) {
    return <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (!deal) {
    return <p className="text-sm text-slate-500">Сделка не найдена.</p>;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sanitizedProbability = Math.min(Math.max(probability, 0), 100);
    const normalizedValue = Number.parseFloat(value);
    const expected = expectedCloseDate ? new Date(expectedCloseDate).toISOString() : null;
    const nextReview = (() => {
      if (!nextReviewDate) {
        return deal.nextReviewAt;
      }

      const parsed = new Date(nextReviewDate);
      if (Number.isNaN(parsed.getTime())) {
        return deal.nextReviewAt;
      }

      return parsed.toISOString();
    })();

    const updated = await updateDeal({
      stage,
      owner: owner.trim() || undefined,
      probability: Number.isFinite(sanitizedProbability) ? sanitizedProbability / 100 : deal.probability,
      value: Number.isFinite(normalizedValue) ? normalizedValue : deal.value,
      expectedCloseDate: expected,
      nextReviewAt: nextReview,
    });

    queryClient.setQueryData(dealKey, updated);
    await queryClient.invalidateQueries({ queryKey: ["deals"] });
    await queryClient.invalidateQueries({ queryKey: DEAL_STAGE_METRICS_QUERY_KEY });
    markDealUpdated(dealId);
  };

  const switchTab = (tab: DealDetailsTab) => {
    setActiveTab(tab);
  };

  const triggerTaskCreation = () => {
    setActiveTab("tasks");
    setTaskRequestKey(String(Date.now()));
  };

  const triggerNoteCreation = () => {
    setActiveTab("activity");
    setNoteRequestKey(String(Date.now()));
  };

  const triggerDocumentUpload = () => {
    setActiveTab("documents");
    setDocumentRequestKey(String(Date.now()));
  };

  return (
    <article
      className={`space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/80 ${
        isHighlighted ? "ring-2 ring-sky-400" : ""
      }`}
    >
      <header className="space-y-2 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{deal.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Клиент:{" "}
              <Link href={`/clients/${deal.clientId}`} className="text-sky-600 hover:underline">
                {deal.clientName}
              </Link>
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Обновлено: {formatDateTime(deal.updatedAt)}
          </div>
        </div>
        <dl className="grid gap-4 text-sm text-slate-600 dark:text-slate-200 sm:grid-cols-5">
          <div>
            <dt className="font-medium">Сумма</dt>
            <dd>{formatCurrency(deal.value)}</dd>
          </div>
          <div>
            <dt className="font-medium">Вероятность</dt>
            <dd>{Math.round(deal.probability * 100)}%</dd>
          </div>
          <div>
            <dt className="font-medium">Стадия</dt>
            <dd>{STAGE_LABELS[deal.stage]}</dd>
          </div>
          <div>
            <dt className="font-medium">Ожидаемое закрытие</dt>
            <dd>{formatDate(deal.expectedCloseDate)}</dd>
          </div>
          <div>
            <dt className="font-medium">Следующий просмотр</dt>
            <dd
              className={deal.nextReviewAt && new Date(deal.nextReviewAt).getTime() < Date.now()
                ? "font-semibold text-amber-600 dark:text-amber-300"
                : undefined}
            >
              {formatDate(deal.nextReviewAt)}
            </dd>
          </div>
        </dl>
      </header>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Быстрое редактирование</h2>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Стадия</label>
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value as DealStage)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Сумма, ₽</label>
            <input
              type="number"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              min={0}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Вероятность, %</label>
            <input
              type="number"
              value={probability}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                setProbability(Number.isNaN(parsed) ? 0 : parsed);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              min={0}
              max={100}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Ожидаемое закрытие</label>
            <input
              type="date"
              value={expectedCloseDate}
              onChange={(event) => setExpectedCloseDate(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Следующий просмотр</label>
            <input
              type="date"
              value={nextReviewDate}
              onChange={(event) => setNextReviewDate(event.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Ответственный</label>
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Укажите владельца сделки"
            />
          </div>
          <div className="flex items-center justify-end gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                if (!deal) {
                  return;
                }
                setStage(deal.stage);
                setValue(String(deal.value));
                setProbability(Math.round(deal.probability * 100));
                setExpectedCloseDate(toDateInput(deal.expectedCloseDate));
                setNextReviewDate(toDateInput(deal.nextReviewAt));
                setOwner(deal.owner ?? "");
              }}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Сбросить
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Сохраняем..." : "Обновить"}
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-sky-600 text-white shadow"
                  : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={triggerTaskCreation}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            Создать задачу
          </button>
          <button
            type="button"
            onClick={triggerNoteCreation}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            Добавить заметку
          </button>
          <button
            type="button"
            onClick={triggerDocumentUpload}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            Загрузить файл
          </button>
        </div>
      </section>

      <section>
        {activeTab === "activity" && (
          <DealActivity
            dealId={dealId}
            createRequestKey={noteRequestKey}
            onCreateHandled={() => setNoteRequestKey(undefined)}
          />
        )}
        {activeTab === "tasks" && (
          <DealTasks
            dealId={dealId}
            createRequestKey={taskRequestKey}
            onCreateHandled={() => setTaskRequestKey(undefined)}
          />
        )}
        {activeTab === "documents" && (
          <DealDocuments
            dealId={dealId}
            createRequestKey={documentRequestKey}
            onCreateHandled={() => setDocumentRequestKey(undefined)}
          />
        )}
        {activeTab === "finance" && <DealFinance dealId={dealId} />}
      </section>
    </article>
  );
}

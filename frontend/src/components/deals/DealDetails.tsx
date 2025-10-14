"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDealDetails, useUpdateDeal } from "@/lib/api/hooks";
import { DealDetailsHeader } from "@/components/deals/details/DealDetailsHeader";
import { DealDetailsTabsNav } from "@/components/deals/details/DealDetailsTabsNav";
import { OverviewTab } from "@/components/deals/details/OverviewTab";
import { FormsTab } from "@/components/deals/details/FormsTab";
import { PoliciesTab } from "@/components/deals/details/PoliciesTab";
import { JournalTab } from "@/components/deals/details/JournalTab";
import { ActionsTab } from "@/components/deals/details/ActionsTab";
import { TasksTab } from "@/components/deals/details/TasksTab";
import { DocumentsTab } from "@/components/deals/details/DocumentsTab";
import { FinanceTab } from "@/components/deals/details/FinanceTab";
import { useUiStore, type DealDetailsTabKey } from "@/stores/uiStore";
import type { DealDetailsData, DealFormGroup } from "@/types/crm";

const DEAL_TABS: Array<{ id: DealDetailsTabKey; label: string }> = [
  { id: "overview", label: "Обзор" },
  { id: "forms", label: "Формы" },
  { id: "policies", label: "Полисы" },
  { id: "journal", label: "Журнал" },
  { id: "actions", label: "Действия" },
  { id: "tasks", label: "Задачи" },
  { id: "documents", label: "Документы" },
  { id: "finance", label: "Финансы" },
];

function cloneForms(forms: DealFormGroup[]): DealFormGroup[] {
  return forms.map((group) => ({
    ...group,
    fields: group.fields.map((field) => ({ ...field })),
  }));
}

function findField(groups: DealFormGroup[], fieldId: string) {
  for (const group of groups) {
    const field = group.fields.find((item) => item.id === fieldId);
    if (field) {
      return field;
    }
  }
  return undefined;
}

function getChangedFields(original: DealFormGroup[], current: DealFormGroup[]) {
  const changes: Record<string, string> = {};
  for (const group of current) {
    for (const field of group.fields) {
      const initial = findField(original, field.id);
      if (!initial) {
        continue;
      }
      if ((initial.value ?? "") !== (field.value ?? "")) {
        changes[field.id] = field.value;
      }
    }
  }
  return changes;
}

function parseNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value.replace(/\s+/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DealDetails({ dealId }: { dealId: string }) {
  const { data: deal, isLoading, isError, error, refetch } = useDealDetails(dealId);
  const { mutateAsync: updateDeal, isPending: isSaving } = useUpdateDeal(dealId);
  const activeTab = useUiStore((state) => state.dealDetailsTab);
  const setActiveTab = useUiStore((state) => state.setDealDetailsTab);
  const triggerRequest = useUiStore((state) => state.triggerDealDetailsRequest);
  const requests = useUiStore((state) => state.dealDetailsRequests);
  const consumeRequest = useUiStore((state) => state.consumeDealDetailsRequest);

  const [formState, setFormState] = useState<DealFormGroup[]>([]);
  const [saveError, setSaveError] = useState<string | undefined>();

  useEffect(() => {
    if (deal) {
      setFormState(cloneForms(deal.forms));
    }
  }, [deal]);

  useEffect(() => {
    if (requests.task) {
      consumeRequest("task");
    }
    if (requests.note) {
      consumeRequest("note");
    }
  }, [consumeRequest, requests.note, requests.task]);

  useEffect(() => {
    if (requests.document) {
      // consumption happens after highlight is passed to DocumentsTab
      const timeout = window.setTimeout(() => consumeRequest("document"), 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [consumeRequest, requests.document]);

  const hasChanges = useMemo(() => {
    if (!deal) {
      return false;
    }
    const changes = getChangedFields(deal.forms, formState);
    return Object.keys(changes).length > 0;
  }, [deal, formState]);

  const handleFieldChange = (groupId: string, fieldId: string, value: string) => {
    setFormState((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        return {
          ...group,
          fields: group.fields.map((field) =>
            field.id === fieldId
              ? {
                  ...field,
                  value,
                  error: undefined,
                }
              : field,
          ),
        };
      }),
    );
  };

  const resetForm = () => {
    if (deal) {
      setFormState(cloneForms(deal.forms));
    }
    setSaveError(undefined);
  };

  const handleSave = async () => {
    if (!deal) {
      return;
    }

    const nextReviewField = findField(formState, "nextReviewAt");
    if (!nextReviewField || !nextReviewField.value) {
      setFormState((prev) =>
        prev.map((group) => ({
          ...group,
          fields: group.fields.map((field) =>
            field.id === "nextReviewAt"
              ? { ...field, error: "Поле обязательно для сохранения" }
              : field,
          ),
        })),
      );
      setSaveError("Заполните дату следующего просмотра.");
      setActiveTab("forms");
      return;
    }

    setSaveError(undefined);
    const changes = getChangedFields(deal.forms, formState);

    const payload = {
      name: changes.name ?? deal.name,
      owner: changes.owner ?? deal.owner,
      nextReviewAt: new Date((changes.nextReviewAt ?? findField(formState, "nextReviewAt")?.value) ?? deal.nextReviewAt)
        .toISOString(),
      expectedCloseDate: changes.expectedCloseDate
        ? new Date(changes.expectedCloseDate).toISOString()
        : deal.expectedCloseDate ?? null,
      value: parseNumber(changes.value) ?? deal.value,
      probability: (() => {
        const raw = parseNumber(changes.probability);
        if (raw === undefined) {
          return deal.probability;
        }
        return Math.min(Math.max(raw, 0), 100) / 100;
      })(),
    };

    try {
      await updateDeal(payload);
      await refetch();
    } catch (updateError) {
      setSaveError(updateError instanceof Error ? updateError.message : "Не удалось сохранить изменения");
    }
  };

  const renderContent = (currentDeal: DealDetailsData) => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab deal={currentDeal} onOpenPolicies={() => setActiveTab("policies")} />;
      case "forms":
        return <FormsTab groups={formState} onFieldChange={handleFieldChange} />;
      case "policies":
        return <PoliciesTab policies={currentDeal.policies} />;
      case "journal":
        return <JournalTab activity={currentDeal.activity} />;
      case "actions":
        return <ActionsTab actions={currentDeal.actions} />;
      case "tasks":
        return <TasksTab board={currentDeal.tasksBoard} onCreateTask={() => triggerRequest("task")} />;
      case "documents":
        return (
          <DocumentsTab
            categories={currentDeal.documentsV2}
            highlightKey={requests.document}
            onUpload={(files) => {
              console.info("Загруженные файлы", files);
            }}
          />
        );
      case "finance":
        return <FinanceTab summary={currentDeal.finance} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="h-[540px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
      />
    );
  }

  if (isError || !deal) {
    return (
      <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
        <p>Не удалось загрузить сделку. {error instanceof Error ? error.message : "Попробуйте обновить страницу."}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-400"
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <DealDetailsHeader deal={deal} />

      {saveError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
          {saveError}
        </div>
      ) : null}

      <DealDetailsTabsNav
        tabs={DEAL_TABS.map((tab) => ({
          ...tab,
          badge:
            tab.id === "documents"
              ? deal.documentsV2.reduce((acc, category) => acc + category.documents.length, 0)
              : tab.id === "tasks"
                ? deal.tasksBoard.lanes.reduce((acc, lane) => acc + lane.tasks.length, 0)
                : undefined,
        }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <section>{renderContent(deal)}</section>

      <footer className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            Следующий обзор:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(deal.nextReviewAt))}
            </span>
          </span>
          <span>·</span>
          <Link href="#" className="text-sky-600 hover:underline">
            Настройки напоминаний
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={resetForm}
            disabled={isSaving || !hasChanges}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={() => triggerRequest("document")}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Создать документ
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Дополнительно
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </footer>
    </article>
  );
}

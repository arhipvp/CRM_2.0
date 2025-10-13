"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { createRandomId } from "@/lib/utils/id";
import { Deal } from "@/types/crm";
import { useDeals, useUpdateDealStage } from "@/lib/api/hooks";
import { DealCard } from "@/components/deals/DealCard";
import { DealPreviewSidebar } from "@/components/deals/DealPreviewSidebar";
import {
  DealBulkActions,
  buildBulkActionNotificationMessage,
} from "@/components/deals/DealBulkActions";
import { PipelineStageKey, useUiStore } from "@/stores/uiStore";

const stageConfig: Record<PipelineStageKey, { title: string; description: string }> = {
  qualification: {
    title: "Квалификация",
    description: "Лиды, с которыми подтверждаем потребность",
  },
  negotiation: {
    title: "Переговоры",
    description: "Обсуждаем условия и готовим предложения",
  },
  proposal: {
    title: "Коммерческое предложение",
    description: "Клиент изучает финальное КП",
  },
  closedWon: {
    title: "Успешно",
    description: "Сделки закрыты и оплачены",
  },
  closedLost: {
    title: "Потеряно",
    description: "Сделки, требующие ретроспективы",
  },
};

const stageOrder: PipelineStageKey[] = [
  "qualification",
  "negotiation",
  "proposal",
  "closedWon",
  "closedLost",
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function groupByStage(deals: Deal[]) {
  const map = new Map<PipelineStageKey, Deal[]>();

  for (const stage of stageOrder) {
    map.set(stage, []);
  }

  for (const deal of deals) {
    const stage = (deal.stage as PipelineStageKey) ?? "qualification";
    const current = map.get(stage) ?? [];
    current.push(deal);
    map.set(stage, current);
  }

  return map;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Произошла ошибка. Повторите попытку позже.";
}

export function DealFunnelBoard() {
  const filters = useUiStore((state) => state.filters);
  const viewMode = useUiStore((state) => state.viewMode);
  const stageFilter = filters.stage;
  const selectedDealIds = useUiStore((state) => state.selectedDealIds);
  const toggleDealSelection = useUiStore((state) => state.toggleDealSelection);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const clearFilters = useUiStore((state) => state.clearFilters);
  const setSelectedStage = useUiStore((state) => state.setSelectedStage);
  const highlightedDealId = useUiStore((state) => state.highlightedDealId);
  const openDealPreview = useUiStore((state) => state.openDealPreview);
  const previewDealId = useUiStore((state) => state.previewDealId);
  const checkHintDismissed = useUiStore((state) => state.isHintDismissed);
  const dismissHint = useUiStore((state) => state.dismissHint);
  const pushNotification = useUiStore((state) => state.pushNotification);

  const dealsQuery = useDeals(filters);
  const { data: deals = [], isLoading, isError, error, isFetching, refetch } = dealsQuery;
  const updateStageMutation = useUpdateDealStage();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const grouped = useMemo(() => groupByStage(deals), [deals]);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [failedUpdate, setFailedUpdate] = useState<{ dealId: string; stage: PipelineStageKey } | null>(null);

  const activeDeal = activeDealId ? deals.find((deal) => deal.id === activeDealId) ?? null : null;
  const hintDismissed = checkHintDismissed("deal-funnel-dnd");

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(String(event.active.id));
  };

  const handleDragCancel = () => {
    setActiveDealId(null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDealId(null);

    if (!over) {
      return;
    }

    const nextStage = over.id as PipelineStageKey | undefined;
    const currentStage = (active.data.current?.stage as PipelineStageKey | undefined) ?? undefined;
    const dealId = String(active.id);

    if (!nextStage || !currentStage || nextStage === currentStage) {
      return;
    }

    setMutationError(null);
    setFailedUpdate(null);

    updateStageMutation.mutate(
      {
        dealId,
        stage: nextStage,
        optimisticUpdate: (deal) => ({
          ...deal,
          stage: nextStage,
          updatedAt: new Date().toISOString(),
        }),
      },
      {
        onError: (mutationErrorValue) => {
          const message = formatError(mutationErrorValue);
          setMutationError(message);
          setFailedUpdate({ dealId, stage: nextStage });
          pushNotification({
            id: createRandomId(),
            message: message || "Не удалось обновить стадию сделки",
            type: "error",
            timestamp: new Date().toISOString(),
            source: "crm",
          });
        },
        onSuccess: () => {
          setMutationError(null);
          setFailedUpdate(null);
        },
      },
    );
  };

  if (viewMode !== "kanban") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <BoardSkeleton />
        </div>
        <DealPreviewSidebar />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-500/60 dark:bg-rose-900/20 dark:text-rose-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold">Не удалось загрузить сделки</p>
            <p className="mt-1 text-xs text-rose-800 dark:text-rose-200/80">{formatError(error)}</p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-500"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  const hasDeals = deals.length > 0;
  const hasBulkSelection = selectedDealIds.length > 0;

  const triggerBulkActionNotification = (actionLabel: string, level: "info" | "warning" = "info") => {
    if (selectedDealIds.length === 0) {
      return;
    }

    pushNotification({
      id: createRandomId(),
      message: buildBulkActionNotificationMessage(actionLabel, selectedDealIds),
      type: level,
      timestamp: new Date().toISOString(),
      source: "crm",
    });

    clearSelection();
  };

  const handleAssignManager = () => triggerBulkActionNotification("Назначить менеджера");
  const handleChangeStage = () => triggerBulkActionNotification("Изменить этап");
  const handleAddTask = () => triggerBulkActionNotification("Добавить задачу");
  const handleDelete = () => triggerBulkActionNotification("Удалить", "warning");

  const containerClassName = classNames(
    "flex flex-col gap-6 lg:flex-row",
    hasBulkSelection && "pb-28",
  );

  return (
    <>
      <div className={containerClassName}>
        <div className="flex-1 space-y-4">
          {!hintDismissed && (
            <div className="rounded-lg border border-dashed border-sky-300 bg-sky-50/80 p-4 text-sm text-slate-700 dark:border-sky-500/60 dark:bg-slate-900/40 dark:text-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-800 dark:text-white">Перетаскивайте карточки, чтобы менять стадию</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                  Поддерживаются клавиши стрелок и Enter: переместите фокус на карточку и используйте клавиши для выбора стадии.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-sky-300 bg-white/70 px-3 py-1 text-xs font-medium text-sky-600 transition hover:bg-sky-100 dark:border-sky-500/60 dark:bg-slate-900/70 dark:text-sky-300"
                onClick={() => dismissHint("deal-funnel-dnd")}
              >
                Понятно
              </button>
            </div>
          </div>
        )}

        {mutationError && failedUpdate && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/70 dark:bg-amber-900/20 dark:text-amber-100">
            <div>
              <p className="font-semibold">Не удалось обновить стадию</p>
              <p className="text-xs opacity-90">{mutationError}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-400"
                onClick={() => {
                  const payload = failedUpdate;
                  setMutationError(null);
                  setFailedUpdate(null);
                  updateStageMutation.mutate({
                    dealId: payload.dealId,
                    stage: payload.stage,
                    optimisticUpdate: (deal) => ({
                      ...deal,
                      stage: payload.stage,
                      updatedAt: new Date().toISOString(),
                    }),
                  });
                }}
              >
                Повторить
              </button>
              <button
                type="button"
                className="rounded-md border border-transparent px-3 py-1 text-xs font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100/60 dark:text-amber-50"
                onClick={() => setMutationError(null)}
              >
                Скрыть
              </button>
            </div>
          </div>
        )}

        {hasDeals ? (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              {stageOrder.map((stage) => {
                const dealsForStage = grouped.get(stage) ?? [];
                return (
                  <StageColumn
                    key={stage}
                    stage={stage}
                    deals={dealsForStage}
                    stageFilter={stageFilter}
                    isFetching={isFetching}
                    highlightedDealId={highlightedDealId}
                    selectedDealIds={selectedDealIds}
                    onToggleStage={() =>
                      setSelectedStage(stageFilter === stage ? "all" : stage)
                    }
                    onToggleSelect={toggleDealSelection}
                    onPreview={openDealPreview}
                  />
                );
              })}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeDeal ? (
                <div className="w-72 max-w-sm">
                  <DealCard deal={activeDeal} highlighted selected showCheckbox={false} isDragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            <p>Сделки не найдены для выбранных фильтров.</p>
            <button
              type="button"
              className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-600 dark:text-slate-200"
              onClick={() => {
                clearFilters();
                setSelectedStage("all");
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

        <DealPreviewSidebar key={previewDealId ?? "preview"} />
      </div>
      <DealBulkActions
        selectedDealIds={selectedDealIds}
        onAssignManager={handleAssignManager}
        onChangeStage={handleChangeStage}
        onAddTask={handleAddTask}
        onDelete={handleDelete}
        onClearSelection={clearSelection}
      />
    </>
  );
}

function StageColumn({
  stage,
  deals,
  stageFilter,
  isFetching,
  highlightedDealId,
  selectedDealIds,
  onToggleStage,
  onToggleSelect,
  onPreview,
}: {
  stage: PipelineStageKey;
  deals: Deal[];
  stageFilter: PipelineStageKey | "all";
  isFetching: boolean;
  highlightedDealId?: string;
  selectedDealIds: string[];
  onToggleStage: () => void;
  onToggleSelect: (dealId: string) => void;
  onPreview: (dealId: string | undefined) => void;
}) {
  const meta = stageConfig[stage];
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const isFiltered = stageFilter !== "all";
  const isSelected = stageFilter === stage;

  const headerClasses = classNames(
    "flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/80",
    isFiltered && !isSelected && "opacity-60",
    (isSelected || isOver) && "ring-2 ring-sky-300 dark:ring-sky-500",
  );

  return (
    <section ref={setNodeRef} className={headerClasses} aria-label={meta.title}>
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{meta.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" aria-hidden="true" />
            )}
            <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {deals.length}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleStage}
          className="text-xs font-medium text-sky-600 transition hover:text-sky-500 dark:text-sky-300"
        >
          {isSelected ? "Сбросить фильтр" : "Фильтровать стадию"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-2">
        {deals.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Нет сделок на этой стадии</p>
        ) : (
          deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              highlighted={highlightedDealId === deal.id}
              selected={selectedDealIds.includes(deal.id)}
              onToggleSelect={() => onToggleSelect(deal.id)}
              onPreview={() => onPreview(deal.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableDealCard({
  deal,
  highlighted,
  selected,
  onToggleSelect,
  onPreview,
}: {
  deal: Deal;
  highlighted?: boolean;
  selected?: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stage: deal.stage },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={classNames("touch-none", isDragging && "z-50")}
    >
      <DealCard
        deal={deal}
        highlighted={highlighted}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onOpenPreview={onPreview}
        isDragging={isDragging}
      />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {stageOrder.map((stage) => (
        <div
          key={stage}
          className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white/40 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-6 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: скелетон использует индекс для генерации
                key={index}
                className="h-20 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

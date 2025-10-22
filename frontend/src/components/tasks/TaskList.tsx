"use client";

import { Fragment, useEffect, useMemo, useState, useId, useRef } from "react";
import Link from "next/link";
import {
  useBulkUpdateTasks,
  useClients,
  useDeals,
  useTasks,
  useToggleTask,
  useUpdateTask,
} from "@/lib/api/hooks";
import type { Task, TaskActivityType, TaskStatus } from "@/types/crm";
import {
  useTasksViewStore,
  type DueDateFilter,
  type TaskFiltersState,
  type TaskViewMode,
} from "@/stores/tasksViewStore";
import { TaskCreateModal } from "./TaskCreateModal";
import { TaskDetailsDrawer } from "./TaskDetailsDrawer";

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: string; background: string; border: string; accent: string }
> = {
  new: {
    label: "Новые",
    badge: "bg-sky-100 text-sky-700",
    background: "bg-white",
    border: "border-sky-200",
    accent: "bg-sky-500",
  },
  in_progress: {
    label: "В работе",
    badge: "bg-violet-100 text-violet-700",
    background: "bg-white",
    border: "border-violet-200",
    accent: "bg-violet-500",
  },
  waiting: {
    label: "Ожидают клиента",
    badge: "bg-amber-100 text-amber-700",
    background: "bg-white",
    border: "border-amber-200",
    accent: "bg-amber-500",
  },
  done: {
    label: "Готово",
    badge: "bg-emerald-100 text-emerald-700",
    background: "bg-white",
    border: "border-emerald-200",
    accent: "bg-emerald-500",
  },
  cancelled: {
    label: "Отменено",
    badge: "bg-slate-200 text-slate-600",
    background: "bg-white",
    border: "border-slate-200",
    accent: "bg-slate-400",
  },
};

const TYPE_LABELS: Record<TaskActivityType, string> = {
  call: "Звонок",
  meeting: "Встреча",
  document: "Документы",
  reminder: "Напоминание",
  follow_up: "Фоллоу-ап",
  other: "Другое",
};

const BOARD_COLUMNS: Array<{ value: TaskStatus; limit?: number }> = [
  { value: "new", limit: 6 },
  { value: "in_progress", limit: 6 },
  { value: "waiting", limit: 6 },
  { value: "done" },
  { value: "cancelled" },
];

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});

export function TaskList({ initialSelectedTaskIds = [] }: { initialSelectedTaskIds?: string[] } = {}) {
  const { data, isLoading, isError, error, refetch } = useTasks();
  const { mutateAsync: toggleTask, isPending: isToggling } = useToggleTask();
  const { mutateAsync: updateTask, isPending: isUpdatingTask } = useUpdateTask();
  const {
    mutateAsync: bulkUpdate,
    isPending: isBulkUpdating,
    error: bulkError,
    reset: resetBulkError,
  } = useBulkUpdateTasks();
  const { data: dealsData } = useDeals();
  const { data: clientsData } = useClients();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const previousSelectionRef = useRef<string[]>([]);

  const viewMode = useTasksViewStore((state) => state.viewMode);
  const setViewMode = useTasksViewStore((state) => state.setViewMode);
  const filters = useTasksViewStore((state) => state.filters);
  const setStatuses = useTasksViewStore((state) => state.setStatuses);
  const setOwners = useTasksViewStore((state) => state.setOwners);
  const setTypes = useTasksViewStore((state) => state.setTypes);
  const setTags = useTasksViewStore((state) => state.setTags);
  const setDueDate = useTasksViewStore((state) => state.setDueDate);
  const resetFilters = useTasksViewStore((state) => state.resetFilters);

  const tasks = useMemo(() => data ?? [], [data]);
  const { statuses, owners, types, tags, dueDate } = filters;

  const uniqueOwners = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.owner))).sort((a, b) => a.localeCompare(b, "ru")),
    [tasks],
  );

  const uniqueTypes = useMemo(
    () =>
      Array.from(new Set(tasks.map((task) => task.type))).sort((a, b) =>
        TYPE_LABELS[a].localeCompare(TYPE_LABELS[b], "ru"),
      ),
    [tasks],
  );

  const uniqueTags = useMemo(
    () =>
      Array.from(new Set(tasks.flatMap((task) => task.tags.map((tag) => tag.toLowerCase())))).sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [tasks],
  );

  const selectedContextTask = useMemo(() => {
    if (selectedTaskIds.length !== 1) {
      return undefined;
    }

    return tasks.find((task) => task.id === selectedTaskIds[0]);
  }, [selectedTaskIds, tasks]);

  const activeTask = useMemo(() => {
    if (!activeTaskId) {
      return null;
    }

    return tasks.find((task) => task.id === activeTaskId) ?? null;
  }, [activeTaskId, tasks]);

  const defaultOwnerForCreation = useMemo(() => {
    if (owners.length === 1) {
      return owners[0];
    }

    return selectedContextTask?.owner;
  }, [owners, selectedContextTask]);

  const defaultDealForCreation = selectedContextTask?.dealId;
  const defaultClientForCreation = selectedContextTask?.clientId;

  const tasksByNonDateFilters = useMemo(
    () => filterTasksByAttributes(tasks, { statuses, owners, types, tags }),
    [tasks, statuses, owners, types, tags],
  );

  const filteredTasks = useMemo(
    () => tasksByNonDateFilters.filter((task) => isTaskWithinRange(task, dueDate)),
    [tasksByNonDateFilters, dueDate],
  );

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      const visible = prev.filter((id) => filteredTasks.some((task) => task.id === id));
      if (visible.length === prev.length) {
        return prev;
      }
      return visible;
    });
    setActiveTaskId((prev) => {
      if (!prev) {
        return prev;
      }

      return filteredTasks.some((task) => task.id === prev) ? prev : null;
    });
  }, [filteredTasks]);

  useEffect(() => {
    if (initialSelectedTaskIds.length === 0) {
      return;
    }

    setSelectedTaskIds((prev) => (prev.length === 0 ? initialSelectedTaskIds : prev));
    setActiveTaskId((prev) => prev ?? initialSelectedTaskIds[0] ?? null);
  }, [initialSelectedTaskIds]);

  useEffect(() => {
    if (bulkError) {
      setFeedback({
        type: "error",
        message: bulkError instanceof Error ? bulkError.message : "Не удалось применить действие",
      });
    }
  }, [bulkError]);

  useEffect(() => {
    const previous = previousSelectionRef.current;
    const unchanged =
      previous.length === selectedTaskIds.length &&
      previous.every((id, index) => id === selectedTaskIds[index]);

    if (!unchanged) {
      if (selectedTaskIds.length === 1) {
        setActiveTaskId(selectedTaskIds[0]);
      } else if (selectedTaskIds.length > 1) {
        setActiveTaskId(null);
      }
    }

    previousSelectionRef.current = [...selectedTaskIds];
  }, [selectedTaskIds]);

  const handleSelectTask = (taskId: string, selected: boolean) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return Array.from(next);
    });
  };

  const handleSelectAll = (select: boolean, taskIds: string[]) => {
    setSelectedTaskIds((prev) => {
      if (!select) {
        const next = new Set(prev);
        for (const id of taskIds) {
          next.delete(id);
        }
        return Array.from(next);
      }
      return Array.from(new Set([...prev, ...taskIds]));
    });
  };

  const handleOpenTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setSelectedTaskIds((prev) => {
      if (prev.length === 1 && prev[0] === taskId) {
        return prev;
      }
      return [taskId];
    });
  };

  const handleToggleCompletion = async (taskId: string, completed: boolean) => {
    try {
      await toggleTask({ taskId, completed });
      setFeedback({
        type: "success",
        message: completed ? "Задача помечена как выполненная" : "Статус задачи обновлён",
      });
    } catch (mutationError) {
      console.error("Не удалось обновить статус задачи", mutationError);
      setFeedback({ type: "error", message: "Не удалось обновить статус задачи" });
    }
  };

  const handleMoveTask = async (taskId: string, status: TaskStatus) => {
    try {
      await updateTask({ taskId, payload: { status } });
      setFeedback({
        type: "success",
        message: `Задача перемещена в статус «${STATUS_CONFIG[status].label}»`,
      });
    } catch (mutationError) {
      console.error("Не удалось переместить задачу", mutationError);
      setFeedback({ type: "error", message: "Не удалось переместить задачу" });
    }
  };

  const handleBulkStatusChange = async (status: TaskStatus) => {
    if (selectedTaskIds.length === 0) {
      return;
    }

    try {
      await bulkUpdate({ taskIds: selectedTaskIds, payload: { status } });
      setFeedback({
        type: "success",
        message: `Применён статус «${STATUS_CONFIG[status].label}» для ${selectedTaskIds.length} задач`,
      });
      resetBulkError();
    } catch (mutationError) {
      console.error("Не удалось применить массовое изменение статуса", mutationError);
      setFeedback({ type: "error", message: "Не удалось применить массовое изменение статуса" });
    }
  };

  const handleBulkAssignOwner = async (owner: string) => {
    if (selectedTaskIds.length === 0) {
      return;
    }

    try {
      await bulkUpdate({ taskIds: selectedTaskIds, payload: { owner } });
      setFeedback({
        type: "success",
        message: `Назначен исполнитель «${owner}» для ${selectedTaskIds.length} задач`,
      });
      resetBulkError();
    } catch (mutationError) {
      console.error("Не удалось назначить исполнителя", mutationError);
      setFeedback({ type: "error", message: "Не удалось назначить исполнителя" });
    }
  };

  const handleBulkShiftDueDate = async (shift: number) => {
    if (selectedTaskIds.length === 0) {
      return;
    }

    try {
      await bulkUpdate({ taskIds: selectedTaskIds, payload: {}, options: { shiftDueDateByDays: shift } });
      setFeedback({
        type: "success",
        message: `Срок перенесён на ${shift} дн. для ${selectedTaskIds.length} задач`,
      });
      resetBulkError();
    } catch (mutationError) {
      console.error("Не удалось перенести срок", mutationError);
      setFeedback({ type: "error", message: "Не удалось перенести срок" });
    }
  };

  const clearDueDateFilter = () => {
    setDueDate(undefined);
  };

  const selectedCount = selectedTaskIds.length;

  return (
    <div className="space-y-6">
      <TaskCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        owners={uniqueOwners}
        deals={dealsData ?? []}
        clients={clientsData ?? []}
        defaultOwner={defaultOwnerForCreation}
        defaultDealId={defaultDealForCreation}
        defaultClientId={defaultClientForCreation}
        onTaskCreated={(task) => {
          setFeedback({ type: "success", message: `Задача «${task.title}» создана` });
        }}
      />

      <TaskHeader
        viewMode={viewMode}
        onChangeView={setViewMode}
        filters={filters}
        onChangeStatuses={setStatuses}
        onChangeOwners={setOwners}
        onChangeTypes={setTypes}
        onChangeTags={setTags}
        onResetFilters={() => {
          resetFilters();
          clearDueDateFilter();
        }}
        owners={uniqueOwners}
        types={uniqueTypes}
        tags={uniqueTags}
        onCreateTask={() => setCreateModalOpen(true)}
      />

      {feedback && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {selectedCount > 0 && (
        <TaskMassActionsBar
          isProcessing={isBulkUpdating}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkAssign={handleBulkAssignOwner}
          onBulkShift={handleBulkShiftDueDate}
          owners={uniqueOwners}
          selectedCount={selectedCount}
          onClearSelection={() => setSelectedTaskIds([])}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[3fr_1fr]">
        <div className="space-y-4">
          {isLoading && <TaskListLoading />}

          {isError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
              <p className="font-medium">Не удалось загрузить задачи.</p>
              <p className="mt-1">{error instanceof Error ? error.message : "Произошла ошибка синхронизации"}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 inline-flex items-center rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700"
              >
                Повторить загрузку
              </button>
            </div>
          )}

          {!isLoading && !isError && filteredTasks.length === 0 && (
            <TaskEmptyState onResetFilters={resetFilters} isFiltered={hasActiveFilters(filters)} />
          )}

          {!isLoading && !isError && filteredTasks.length > 0 && (
            <Fragment>
              {viewMode === "table" ? (
                <TaskTableView
                  tasks={filteredTasks}
                  selectedTaskIds={selectedTaskIds}
                  onSelectTask={handleSelectTask}
                  onSelectAll={handleSelectAll}
                  onToggleCompletion={handleToggleCompletion}
                  onOpenTask={handleOpenTask}
                  isToggling={isToggling}
                  isUpdating={isUpdatingTask}
                />
              ) : (
                <TaskKanbanBoard
                  tasks={filteredTasks}
                  selectedTaskIds={selectedTaskIds}
                  onSelectTask={handleSelectTask}
                  onToggleCompletion={handleToggleCompletion}
                  onMoveTask={handleMoveTask}
                  onOpenTask={handleOpenTask}
                  isToggling={isToggling || isUpdatingTask}
                />
              )}
            </Fragment>
          )}
        </div>

        <TaskReminderCalendar
          tasks={tasksByNonDateFilters}
          view={calendarView}
          onViewChange={setCalendarView}
          selectedRange={filters.dueDate}
          onSelectRange={(range) => setDueDate(range)}
          onClearRange={clearDueDateFilter}
        />
      </div>

      <TaskDetailsDrawer
        task={activeTask}
        isOpen={Boolean(activeTask)}
        onClose={() => setActiveTaskId(null)}
        owners={uniqueOwners}
        statusConfig={STATUS_CONFIG}
      />
  </div>
  );
}

interface TaskHeaderProps {
  viewMode: TaskViewMode;
  onChangeView: (mode: TaskViewMode) => void;
  filters: TaskFiltersState;
  onChangeStatuses: (statuses: TaskStatus[]) => void;
  onChangeOwners: (owners: string[]) => void;
  onChangeTypes: (types: TaskActivityType[]) => void;
  onChangeTags: (tags: string[]) => void;
  onResetFilters: () => void;
  owners: string[];
  types: TaskActivityType[];
  tags: string[];
  onCreateTask: () => void;
}

function TaskHeader({
  viewMode,
  onChangeView,
  filters,
  onChangeStatuses,
  onChangeOwners,
  onChangeTypes,
  onChangeTags,
  onResetFilters,
  owners,
  types,
  tags,
  onCreateTask,
}: TaskHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Задачи и планирование</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Отслеживайте статусы, исполнителей и дедлайны
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCreateTask}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <span aria-hidden="true">+</span>
            Создать задачу
          </button>
          <ViewModeToggle value={viewMode} onChange={onChangeView} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FilterGroup
          title="Статусы"
          description="Фильтрация задач по текущему состоянию"
          options={BOARD_COLUMNS.filter((column) => column.value !== "cancelled").map((column) => ({
            value: column.value,
            label: STATUS_CONFIG[column.value].label,
          }))}
          selected={filters.statuses}
          onChange={(values) => onChangeStatuses(values as TaskStatus[])}
        />
        <FilterGroup
          title="Исполнители"
          description="Выберите одного или нескольких исполнителей"
          options={owners.map((owner) => ({ value: owner, label: owner }))}
          selected={filters.owners}
          onChange={onChangeOwners}
        />
        <FilterGroup
          title="Тип задачи"
          description="Тип активности и рабочий контекст"
          options={types.map((type) => ({ value: type, label: TYPE_LABELS[type] }))}
          selected={filters.types}
          onChange={(values) => onChangeTypes(values as TaskActivityType[])}
        />
        <FilterGroup
          title="Теги"
          description="Контекстные метки"
          options={tags.map((tag) => ({ value: tag, label: `#${tag}` }))}
          selected={filters.tags}
          onChange={onChangeTags}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActiveFiltersSummary filters={filters} onClear={onResetFilters} />
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Сбросить фильтры
        </button>
      </div>
    </div>
  );
}

interface FilterGroupProps {
  title: string;
  description: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
}

function FilterGroup({ title, description, options, selected, onChange }: FilterGroupProps) {
  const handleToggle = (value: string, checked: boolean) => {
    onChange(checked ? [...selected, value] : selected.filter((item) => item !== value));
  };

  return (
    <fieldset className="rounded-lg border border-slate-200 p-3 shadow-sm dark:border-slate-700">
      <legend className="text-sm font-semibold text-slate-700 dark:text-slate-100">{title}</legend>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-300">{description}</p>
      <div className="flex flex-wrap gap-2">
        {options.length === 0 && <span className="text-xs text-slate-400">Нет данных</span>}
        {options.map((option) => (
          <label
            key={option.value}
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs shadow-sm transition ${
              selected.includes(option.value)
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={selected.includes(option.value)}
              onChange={(event) => handleToggle(option.value, event.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ViewModeToggle({ value, onChange }: { value: TaskViewMode; onChange: (mode: TaskViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-800">
      {[
        { value: "table" as TaskViewMode, label: "Таблица" },
        { value: "kanban" as TaskViewMode, label: "Канбан" },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
            value === option.value ? "bg-white text-sky-600 shadow" : "text-slate-500 hover:text-slate-700"
          }`}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ActiveFiltersSummary({ filters, onClear }: { filters: TaskFiltersState; onClear: () => void }) {
  const chips = useMemo(() => {
    const items: Array<{ key: string; label: string }> = [];

    if (filters.statuses.length) {
      items.push({
        key: "status",
        label: `Статусы: ${filters.statuses
          .map((status) => STATUS_CONFIG[status].label)
          .join(", ")}`,
      });
    }
    if (filters.owners.length) {
      items.push({ key: "owner", label: `Исполнители: ${filters.owners.join(", ")}` });
    }
    if (filters.types.length) {
      items.push({ key: "types", label: `Типы: ${filters.types.map((type) => TYPE_LABELS[type]).join(", ")}` });
    }
    if (filters.tags.length) {
      items.push({ key: "tags", label: `Теги: ${filters.tags.map((tag) => `#${tag}`).join(", ")}` });
    }
    if (filters.dueDate) {
      const from = filters.dueDate.from ? DATE_FORMATTER.format(new Date(filters.dueDate.from)) : undefined;
      const to = filters.dueDate.to ? DATE_FORMATTER.format(new Date(filters.dueDate.to)) : undefined;
      items.push({
        key: "due",
        label: `Срок: ${from && to && from === to ? from : `${from ?? ""} — ${to ?? ""}`}`,
      });
    }

    return items;
  }, [filters]);

  if (chips.length === 0) {
    return <span className="text-xs text-slate-400">Фильтры не применены</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
        >
          {chip.label}
        </span>
      ))}
      <button type="button" onClick={onClear} className="text-xs font-semibold text-sky-600 hover:underline">
        Очистить
      </button>
    </div>
  );
}

function TaskMassActionsBar({
  selectedCount,
  owners,
  isProcessing,
  onBulkStatusChange,
  onBulkAssign,
  onBulkShift,
  onClearSelection,
}: {
  selectedCount: number;
  owners: string[];
  isProcessing: boolean;
  onBulkStatusChange: (status: TaskStatus) => void;
  onBulkAssign: (owner: string) => void;
  onBulkShift: (shift: number) => void;
  onClearSelection: () => void;
}) {
  const statusId = useId();
  const ownerId = useId();
  const shiftId = useId();

  const [status, setStatus] = useState<TaskStatus>("done");
  const [owner, setOwner] = useState<string>(owners[0] ?? "");
  const [shift, setShift] = useState<number>(1);

  useEffect(() => {
    if (!owners.includes(owner) && owners.length > 0) {
      setOwner(owners[0]);
    }
  }, [owner, owners]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-100">
          Выбрано задач: <span className="font-semibold text-sky-600">{selectedCount}</span>
        </p>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          Очистить выделение
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500" htmlFor={statusId}>
            Изменить статус
          </label>
          <div className="flex items-center gap-2">
            <select
              id={statusId}
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500"
            >
              {BOARD_COLUMNS.filter((column) => column.value !== "cancelled").map((column) => (
                <option key={column.value} value={column.value}>
                  {STATUS_CONFIG[column.value].label}
                </option>
              ))}
              <option value="cancelled">{STATUS_CONFIG.cancelled.label}</option>
            </select>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onBulkStatusChange(status)}
              className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              Применить
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500" htmlFor={ownerId}>
            Назначить исполнителя
          </label>
          <div className="flex items-center gap-2">
            <select
              id={ownerId}
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500"
            >
              {owners.length === 0 && <option value="">Нет исполнителей</option>}
              {owners.map((currentOwner) => (
                <option key={currentOwner} value={currentOwner}>
                  {currentOwner}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isProcessing || !owner}
              onClick={() => owner && onBulkAssign(owner)}
              className="inline-flex items-center rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              Назначить
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500" htmlFor={shiftId}>
            Перенести срок
          </label>
          <div className="flex items-center gap-2">
            <select
              id={shiftId}
              value={shift}
              onChange={(event) => setShift(Number.parseInt(event.target.value, 10))}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-sky-500"
            >
              {[1, 3, 7, 14].map((value) => (
                <option key={value} value={value}>
                  На {value} дн.
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onBulkShift(shift)}
              className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              Перенести
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskTableView({
  tasks,
  selectedTaskIds,
  onSelectTask,
  onSelectAll,
  onToggleCompletion,
  onOpenTask,
  isToggling,
  isUpdating,
}: {
  tasks: Task[];
  selectedTaskIds: string[];
  onSelectTask: (taskId: string, selected: boolean) => void;
  onSelectAll: (select: boolean, taskIds: string[]) => void;
  onToggleCompletion: (taskId: string, completed: boolean) => void;
  onOpenTask: (taskId: string) => void;
  isToggling: boolean;
  isUpdating: boolean;
}) {
  const allSelected = tasks.every((task) => selectedTaskIds.includes(task.id));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={allSelected}
                aria-label="Выбрать все"
                onChange={(event) => onSelectAll(event.target.checked, tasks.map((task) => task.id))}
              />
            </th>
            <th className="px-4 py-3 text-left">Задача</th>
            <th className="px-4 py-3 text-left">Статус</th>
            <th className="px-4 py-3 text-left">Срок</th>
            <th className="px-4 py-3 text-left">Исполнитель</th>
            <th className="px-4 py-3 text-left">Тип</th>
            <th className="px-4 py-3 text-left">Теги</th>
            <th className="px-4 py-3 text-right">Действие</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {tasks.map((task) => {
            const overdue = !task.completed && new Date(task.dueDate).getTime() < Date.now();
            return (
              <tr key={task.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    aria-label={`Выбрать задачу ${task.title}`}
                    checked={selectedTaskIds.includes(task.id)}
                    onChange={(event) => onSelectTask(task.id, event.target.checked)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenTask(task.id)}
                      className="text-left text-base font-medium text-slate-800 transition hover:text-sky-600 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-100"
                    >
                      {task.title}
                    </button>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {task.dealId && (
                        <Link href={`/deals/${task.dealId}`} className="text-sky-600 hover:underline">
                          Сделка
                        </Link>
                      )}
                      {task.clientId && <span>Клиент: {task.clientId}</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CONFIG[task.status].badge}`}>
                    {STATUS_CONFIG[task.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="flex flex-col">
                    <span>{DATE_TIME_FORMATTER.format(new Date(task.dueDate))}</span>
                    {overdue && <span className="text-xs font-semibold text-amber-600">Просрочено</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{task.owner}</td>
                <td className="px-4 py-3 text-slate-600">{TYPE_LABELS[task.type]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={task.completed}
                      disabled={isToggling || isUpdating}
                      onChange={(event) => onToggleCompletion(task.id, event.target.checked)}
                    />
                    Завершить
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskKanbanBoard({
  tasks,
  selectedTaskIds,
  onSelectTask,
  onToggleCompletion,
  onMoveTask,
  onOpenTask,
  isToggling,
}: {
  tasks: Task[];
  selectedTaskIds: string[];
  onSelectTask: (taskId: string, selected: boolean) => void;
  onToggleCompletion: (taskId: string, completed: boolean) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onOpenTask: (taskId: string) => void;
  isToggling: boolean;
}) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const status of Object.keys(STATUS_CONFIG) as TaskStatus[]) {
      map.set(status, []);
    }
    for (const task of tasks) {
      const bucket = map.get(task.status);
      if (bucket) {
        bucket.push(task);
      }
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }
    return map;
  }, [tasks]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BOARD_COLUMNS.map((column) => {
        const columnTasks = grouped.get(column.value) ?? [];
        if (column.value === "cancelled" && columnTasks.length === 0) {
          return null;
        }
        const limit = column.limit ?? Infinity;
        const overloaded = columnTasks.length > limit;
        const completedCount = columnTasks.filter((task) => task.completed).length;
        const progress = columnTasks.length > 0 ? Math.round((completedCount / columnTasks.length) * 100) : 0;

        return (
          <div
            key={column.value}
            className={`flex flex-col gap-3 rounded-lg border p-4 shadow-sm transition ${
              overloaded ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData("text/plain") || draggedTask;
              if (taskId) {
                onMoveTask(taskId, column.value);
                setDraggedTask(null);
              }
            }}
            aria-label={`Колонка ${STATUS_CONFIG[column.value].label}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">
                  {STATUS_CONFIG[column.value].label}
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {columnTasks.length}
                  </span>
                </h3>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`${STATUS_CONFIG[column.value].accent} h-2 transition-all`}
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  />
                </div>
              </div>
              {overloaded && <span className="text-xs font-semibold text-amber-600">Перегрузка</span>}
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {columnTasks.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-400">
                  Нет задач
                </div>
              )}
              {columnTasks.map((task) => {
                const overdue = !task.completed && new Date(task.dueDate).getTime() < Date.now();
                return (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", task.id);
                      setDraggedTask(task.id);
                    }}
                    onDragEnd={() => setDraggedTask(null)}
                    className={`rounded-lg border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 ${
                      overdue ? "border-amber-300" : STATUS_CONFIG[task.status].border
                    } ${selectedTaskIds.includes(task.id) ? "ring-2 ring-sky-400" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-800">
                        <button
                          type="button"
                          onClick={() => onOpenTask(task.id)}
                          className="text-left text-sm font-semibold text-slate-800 transition hover:text-sky-600 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-sky-500"
                        >
                          {task.title}
                        </button>
                      </h4>
                      <label className="flex items-center gap-1 text-[11px] text-slate-500">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={(event) => onSelectTask(task.id, event.target.checked)}
                        />
                        Выбрать
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{TYPE_LABELS[task.type]}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Срок: {DATE_TIME_FORMATTER.format(new Date(task.dueDate))}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Исполнитель: {task.owner}</p>
                    {task.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <label className="inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          checked={task.completed}
                          disabled={isToggling}
                          onChange={(event) => onToggleCompletion(task.id, event.target.checked)}
                        />
                        Завершить
                      </label>
                      {task.dealId && (
                        <Link href={`/deals/${task.dealId}`} className="text-sky-600 hover:underline">
                          Сделка
                        </Link>
                      )}
                    </div>
                    {overdue && <p className="mt-2 text-[11px] font-semibold text-amber-600">Просрочено</p>}
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TaskReminderCalendarProps {
  tasks: Task[];
  view: "week" | "month";
  onViewChange: (view: "week" | "month") => void;
  selectedRange?: DueDateFilter;
  onSelectRange: (range: DueDateFilter | undefined) => void;
  onClearRange: () => void;
}

function TaskReminderCalendar({
  tasks,
  view,
  onViewChange,
  selectedRange,
  onSelectRange,
  onClearRange,
}: TaskReminderCalendarProps) {
  const [cursor, setCursor] = useState(() => new Date());

  useEffect(() => {
    if (selectedRange?.from) {
      setCursor(new Date(selectedRange.from));
    }
  }, [selectedRange?.from]);

  const days = useMemo(() => {
    if (view === "week") {
      return createWeekRange(cursor);
    }
    return createMonthRange(cursor);
  }, [cursor, view]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = startOfDayIso(new Date(task.dueDate));
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const isSelectedDay = (date: Date) => {
    if (!selectedRange?.from || !selectedRange?.to) {
      return false;
    }
    const time = date.getTime();
    return time >= new Date(selectedRange.from).getTime() && time <= new Date(selectedRange.to).getTime();
  };

  const selectedTasks = useMemo(() => {
    if (!selectedRange) {
      return [];
    }
    return tasks.filter((task) => isTaskWithinRange(task, selectedRange));
  }, [selectedRange, tasks]);

  return (
    <aside className="flex h-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">Напоминания</h3>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1 shadow-inner">
          {(
            [
              { value: "week" as const, label: "Неделя" },
              { value: "month" as const, label: "Месяц" },
            ] satisfies Array<{ value: "week" | "month"; label: string }>
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onViewChange(option.value)}
              className={`rounded px-3 py-1 text-xs font-semibold transition ${
                view === option.value ? "bg-white text-sky-600 shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          onClick={() => setCursor(shiftDate(cursor, view === "week" ? -7 : -30))}
          className="rounded-md border border-slate-200 px-2 py-1 transition hover:bg-slate-50"
        >
          Назад
        </button>
        <span className="font-medium text-slate-600">
          {view === "week"
            ? `${DATE_FORMATTER.format(days[0])} — ${DATE_FORMATTER.format(days[days.length - 1])}`
            : new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(cursor)}
        </span>
        <button
          type="button"
          onClick={() => setCursor(shiftDate(cursor, view === "week" ? 7 : 30))}
          className="rounded-md border border-slate-200 px-2 py-1 transition hover:bg-slate-50"
        >
          Вперёд
        </button>
      </div>
      <div className={`grid ${view === "week" ? "grid-cols-7" : "grid-cols-7"} gap-2`}>
        {days.map((day) => {
          const key = startOfDayIso(day);
          const dayTasks = tasksByDay.get(key) ?? [];
          const hasReminder = dayTasks.some((task) => task.reminderAt);
          const overdueCount = dayTasks.filter((task) => !task.completed && new Date(task.dueDate) < new Date()).length;
          const selected = isSelectedDay(day);
          const isCurrentMonth = day.getMonth() === cursor.getMonth() || view === "week";

          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                selected
                  ? onSelectRange(undefined)
                  : onSelectRange({ from: startOfDayIso(day), to: endOfDayIso(day) })
              }
              className={`flex h-20 flex-col justify-between rounded-md border p-2 text-left text-xs transition ${
                selected
                  ? "border-sky-400 bg-sky-50"
                  : isCurrentMonth
                    ? "border-slate-200 bg-white hover:border-sky-200"
                    : "border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              <span className="font-semibold">{day.getDate()}</span>
              <span>{new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(day)}</span>
              <span className="text-[11px] text-slate-500">{dayTasks.length} задач</span>
              {hasReminder && <span className="text-[10px] text-emerald-600">Напоминания</span>}
              {overdueCount > 0 && <span className="text-[10px] text-amber-600">Просрочено: {overdueCount}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Выбрано задач: <strong>{selectedTasks.length}</strong>
        </span>
        <button type="button" onClick={onClearRange} className="text-sky-600 hover:underline">
          Сбросить дату
        </button>
      </div>
      {selectedTasks.length > 0 && (
        <div className="space-y-2 overflow-y-auto">
          {selectedTasks.map((task) => (
            <div key={task.id} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="font-semibold text-slate-700">{task.title}</p>
              <p className="text-slate-500">{DATE_TIME_FORMATTER.format(new Date(task.dueDate))}</p>
              <p className="text-slate-500">{task.owner}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function TaskListLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Загрузка задач" className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function TaskEmptyState({ onResetFilters, isFiltered }: { onResetFilters: () => void; isFiltered: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
      <p className="font-semibold text-slate-700">Задачи не найдены</p>
      <p className="mt-1">
        {isFiltered
          ? "Попробуйте изменить параметры фильтрации или сбросить активные фильтры."
          : "Создайте новую задачу в сделке или назначьте активность исполнителю."}
      </p>
      {isFiltered && (
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-3 inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}

function filterTasksByAttributes(
  tasks: Task[],
  filters: Pick<TaskFiltersState, "statuses" | "owners" | "types" | "tags">,
) {
  return tasks.filter((task) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
      return false;
    }
    if (filters.owners.length > 0 && !filters.owners.includes(task.owner)) {
      return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(task.type)) {
      return false;
    }
    if (
      filters.tags.length > 0 &&
      !filters.tags.some((tag) => task.tags.map((item) => item.toLowerCase()).includes(tag))
    ) {
      return false;
    }
    return true;
  });
}

function isTaskWithinRange(task: Task, range: DueDateFilter | undefined) {
  if (!range) {
    return true;
  }
  const due = new Date(task.dueDate).getTime();
  if (range.from && due < new Date(range.from).getTime()) {
    return false;
  }
  if (range.to && due > new Date(range.to).getTime()) {
    return false;
  }
  return true;
}

function hasActiveFilters(filters: TaskFiltersState) {
  return (
    filters.statuses.length > 0 ||
    filters.owners.length > 0 ||
    filters.types.length > 0 ||
    filters.tags.length > 0 ||
    Boolean(filters.dueDate)
  );
}

function startOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function endOfDayIso(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next.toISOString();
}

function createWeekRange(base: Date) {
  const start = startOfWeek(base);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function createMonthRange(base: Date) {
  const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}


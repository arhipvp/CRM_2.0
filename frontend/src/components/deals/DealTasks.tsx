"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  dealQueryOptions,
  dealStageMetricsQueryKey,
  dealTasksQueryOptions,
  dealsQueryKey,
} from "@/lib/api/queries";
import { useCreateDealTask, useDealTasks, useToggleTask } from "@/lib/api/hooks";
import { Task } from "@/types/crm";

interface DealTasksProps {
  dealId: string;
  createRequestKey?: string;
  onCreateHandled?: () => void;
}

function formatDueDate(date: string | undefined) {
  if (!date) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export function DealTasks({ dealId, createRequestKey, onCreateHandled }: DealTasksProps) {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useDealTasks(dealId);
  const { mutateAsync: createTask, isPending: isCreating } = useCreateDealTask(dealId);
  const { mutateAsync: toggleTask } = useToggleTask();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [owner, setOwner] = useState("");

  const tasksKey = useMemo(() => dealTasksQueryOptions(dealId).queryKey, [dealId]);
  const dealKey = useMemo(() => dealQueryOptions(dealId).queryKey, [dealId]);

  useEffect(() => {
    if (createRequestKey) {
      setIsFormOpen(true);
      onCreateHandled?.();
    }
  }, [createRequestKey, onCreateHandled]);

  useEffect(() => {
    if (!isFormOpen) {
      setTitle("");
      setDueDate("");
      setOwner("");
    }
  }, [isFormOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    await createTask({
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      owner: owner.trim() || undefined,
    });

    await queryClient.invalidateQueries({ queryKey: tasksKey });
    await queryClient.invalidateQueries({ queryKey: dealKey });
    await queryClient.invalidateQueries({ queryKey: dealsQueryKey });
    await queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey });

    setIsFormOpen(false);
    setTitle("");
    setDueDate("");
    setOwner("");
  };

  const handleToggle = async (task: Task) => {
    await toggleTask({ taskId: task.id, completed: !task.completed });
    await queryClient.invalidateQueries({ queryKey: tasksKey });
    await queryClient.invalidateQueries({ queryKey: dealKey });
    await queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey });
  };

  const visibleTasks = useMemo(() => sortTasks(tasks), [tasks]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Задачи</h2>
        <button
          type="button"
          onClick={() => setIsFormOpen((prev) => !prev)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          {isFormOpen ? "Закрыть" : "Новая задача"}
        </button>
      </header>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Название</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Например, подготовить КП"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Дедлайн</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Ответственный</label>
              <input
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Укажите ФИО"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Создаём..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : visibleTasks.length === 0 ? (
        <p className="text-sm text-slate-500">Активных задач пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {visibleTasks.map((task) => (
            <li
              key={task.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3 transition hover:border-sky-200 hover:shadow-sm dark:border-slate-700 dark:hover:border-sky-500/60"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(task)}
                    className={`flex h-5 w-5 items-center justify-center rounded border text-xs font-semibold transition ${
                      task.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 text-slate-400 hover:border-sky-400"
                    }`}
                    aria-label={task.completed ? "Снять отметку" : "Отметить выполненным"}
                  >
                    {task.completed ? "✓" : ""}
                  </button>
                  <span className={`text-sm font-medium ${task.completed ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}>
                    {task.title}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>Дедлайн: {formatDueDate(task.dueDate)}</span>
                  {task.owner && <span>Ответственный: {task.owner}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

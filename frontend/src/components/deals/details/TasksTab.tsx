"use client";

import { useMemo, useState } from "react";
import type { DealTaskCard, DealTasksBoard } from "@/types/crm";

interface TasksTabProps {
  board: DealTasksBoard;
  onCreateTask?: () => void;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function TaskCard({ task }: { task: DealTaskCard }) {
  const statusClass =
    task.stage === "done"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
      : task.stage === "in_progress"
        ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300";

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>{task.stage}</span>
        <span className="text-xs text-slate-500">{formatDate(task.dueDate)}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{task.title}</p>
      <p className="text-xs text-slate-500">Ответственный: {task.owner}</p>
      {task.checklist.length > 0 ? (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-300">Чеклист ({task.checklist.filter((item) => item.completed).length}/{task.checklist.length})</summary>
          <ul className="mt-1 space-y-1">
            {task.checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${item.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>
                  {item.completed ? "✓" : ""}
                </span>
                <span className={item.completed ? "text-slate-400 line-through" : undefined}>{item.label}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {task.journalLinkId ? (
        <a href={`#journal-${task.journalLinkId}`} className="text-xs font-medium text-sky-600">
          Открыть запись в журнале
        </a>
      ) : null}
    </div>
  );
}

export function TasksTab({ board, onCreateTask }: TasksTabProps) {
  const [types, setTypes] = useState(board.filters.types);
  const [showForeign, setShowForeign] = useState(board.filters.showForeign);

  const activeTypeIds = useMemo(() => types.filter((type) => type.active).map((type) => type.id), [types]);

  const toggleType = (id: string) => {
    setTypes((prev) => prev.map((type) => (type.id === id ? { ...type, active: !type.active } : type)));
  };

  const lanes = board.lanes.map((lane) => {
    const tasks = lane.tasks.filter((task) => (activeTypeIds.length === 0 ? true : activeTypeIds.includes(task.type)));
    return { ...lane, tasks };
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Тип задачи:</span>
          {types.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => toggleType(type.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                type.active
                  ? "border-sky-600 bg-sky-50 text-sky-600 dark:border-sky-500 dark:bg-sky-900/20 dark:text-sky-200"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {type.label}
            </button>
          ))}
          <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showForeign}
              onChange={(event) => setShowForeign(event.target.checked)}
              className="h-3 w-3 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Показать чужие задачи
          </label>
        </div>
        <button
          type="button"
          onClick={onCreateTask}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Создать задачу
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {lanes.map((lane) => (
          <div key={lane.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{lane.title}</h3>
              {lane.hint ? <p className="text-xs text-slate-500">{lane.hint}</p> : null}
            </div>
            {lane.tasks.length === 0 ? (
              <p className="text-sm text-slate-500">{lane.emptyCta ?? "Нет задач"}</p>
            ) : (
              <div className="space-y-3">
                {lane.tasks
                  .filter((task) => (showForeign ? true : task.owner))
                  .map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

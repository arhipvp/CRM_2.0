"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTasks, useToggleTask } from "@/lib/api/hooks";

function isOverdue(date: string) {
  return new Date(date).getTime() < Date.now();
}

export function TaskList() {
  const { data: tasks = [], isLoading } = useTasks();
  const { mutateAsync: toggleTask, isPending: isToggling } = useToggleTask();

  const handleToggle = async (taskId: string, completed: boolean) => {
    try {
      await toggleTask({ taskId, completed });
    } catch (error) {
      console.error("Не удалось обновить статус задачи", error);
    }
  };

  const sortedTasks = useMemo(
    () =>
      tasks.slice().sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [tasks],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sortedTasks.map((task) => {
        const overdue = !task.completed && isOverdue(task.dueDate);
        return (
          <li
            key={task.id}
            className={`flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/80 ${
              overdue ? "border-amber-400" : ""
            }`}
          >
            <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-100">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                checked={task.completed}
                disabled={isToggling}
                onChange={() => handleToggle(task.id, !task.completed)}
              />
              <span className="flex-1">
                <span className="font-medium">{task.title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-300">
                  Срок: {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.dueDate))}
                </span>
                {task.dealId && (
                  <Link href={`/deals/${task.dealId}`} className="text-xs text-sky-600 hover:underline">
                    Открыть сделку
                  </Link>
                )}
              </span>
            </label>
            {overdue && <p className="text-xs font-medium text-amber-600">Просрочено! Напомните клиенту.</p>}
          </li>
        );
      })}
      {sortedTasks.length === 0 && <p className="text-sm text-slate-500">Задачи не найдены.</p>}
    </ul>
  );
}

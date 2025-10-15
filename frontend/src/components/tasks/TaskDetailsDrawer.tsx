"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateTask } from "@/lib/api/hooks";
import { tasksQueryOptions } from "@/lib/api/queries";
import { createRandomId } from "@/lib/utils/id";
import type { Task, TaskChecklistItem, TaskComment, TaskStatus } from "@/types/crm";
import type { UpdateTaskPayload } from "@/lib/api/client";

interface TaskDetailsDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  owners: string[];
  statusConfig: Record<
    TaskStatus,
    { label: string; badge: string; accent: string; background: string; border: string }
  >;
}

interface BannerState {
  type: "error";
  message: string;
}

interface ToastState {
  type: "success" | "error";
  message: string;
}

interface UpdateOptions {
  successMessage?: string;
  errorMessage?: string;
  toastErrorMessage?: string;
  onSuccess?: (task: Task) => void;
  onError?: (error: unknown) => void;
}

export function TaskDetailsDrawer({ task, isOpen, onClose, owners, statusConfig }: TaskDetailsDrawerProps) {
  const [draft, setDraft] = useState<Task | null>(task);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [newComment, setNewComment] = useState("");
  const updateTaskMutation = useUpdateTask();
  const queryClient = useQueryClient();
  const tasksQueryKey = useMemo(() => tasksQueryOptions().queryKey, []);

  const statusOptions = useMemo(
    () =>
      (Object.keys(statusConfig) as TaskStatus[]).map((value) => ({
        value,
        label: statusConfig[value].label,
      })),
    [statusConfig],
  );

  const ownerOptions = useMemo(() => {
    if (!draft) {
      return owners;
    }
    const unique = new Set<string>(owners);
    if (draft.owner) {
      unique.add(draft.owner);
    }
    return Array.from(unique);
  }, [draft, owners]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      setToast(null);
      setBanner(null);
      setNewComment("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (task) {
      setDraft(cloneTask(task));
    } else {
      setDraft(null);
    }
    setBanner(null);
  }, [task?.id]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const runTaskUpdate = useCallback(
    (payload: UpdateTaskPayload, options: UpdateOptions = {}) => {
      const base = draft ?? task;
      if (!base) {
        return;
      }

      setBanner(null);

      const previousDraft = cloneTask(base);
      const previousTasks = queryClient
        .getQueryData<Task[]>(tasksQueryKey)
        ?.map((existing) => cloneTask(existing));

      const optimisticTask = mergeTask(base, payload);
      const optimisticForList = cloneTask(optimisticTask);

      setDraft(optimisticTask);

      if (previousTasks) {
        queryClient.setQueryData<Task[]>(tasksQueryKey, (current) => {
          if (!current) {
            return current;
          }
          return current.map((item) => (item.id === optimisticTask.id ? optimisticForList : item));
        });
      }

      updateTaskMutation.mutate(
        { taskId: base.id, payload },
        {
          onSuccess: (updated) => {
            const normalized = cloneTask(updated);
            setDraft(normalized);
            queryClient.setQueryData<Task[]>(tasksQueryKey, (current) => {
              if (!current) {
                return current;
              }
              return current.map((item) => (item.id === normalized.id ? cloneTask(normalized) : item));
            });
            setToast({ type: "success", message: options.successMessage ?? "Изменения сохранены" });
            setBanner(null);
            options.onSuccess?.(normalized);
          },
          onError: (mutationError) => {
            setBanner({ type: "error", message: options.errorMessage ?? "Не удалось сохранить изменения" });
            setToast({ type: "error", message: options.toastErrorMessage ?? "Ошибка сохранения" });
            setDraft(previousDraft);
            if (previousTasks) {
              queryClient.setQueryData(tasksQueryKey, previousTasks);
            }
            options.onError?.(mutationError);
          },
        },
      );
    },
    [draft, queryClient, task, tasksQueryKey, updateTaskMutation],
  );

  const handleStatusChange = useCallback(
    (status: TaskStatus) => {
      runTaskUpdate(
        { status, completed: status === "done" },
        {
          successMessage: `Статус обновлён на «${statusConfig[status].label}»`,
          errorMessage: "Не удалось обновить статус задачи",
          toastErrorMessage: "Ошибка при обновлении статуса",
        },
      );
    },
    [runTaskUpdate, statusConfig],
  );

  const handleOwnerChange = useCallback(
    (owner: string) => {
      runTaskUpdate(
        { owner },
        {
          successMessage: `Назначен исполнитель «${owner}»`,
          errorMessage: "Не удалось назначить исполнителя",
          toastErrorMessage: "Ошибка при назначении исполнителя",
        },
      );
    },
    [runTaskUpdate],
  );

  const handleChecklistToggle = useCallback(
    (itemId: string, completed: boolean) => {
      if (!draft?.checklist) {
        return;
      }

      const nextChecklist = draft.checklist.map((item) =>
        item.id === itemId ? { ...item, completed } : item,
      );

      runTaskUpdate(
        { checklist: nextChecklist },
        {
          successMessage: "Чек-лист обновлён",
          errorMessage: "Не удалось обновить чек-лист",
          toastErrorMessage: "Ошибка при обновлении чек-листа",
        },
      );
    },
    [draft, runTaskUpdate],
  );

  const handleAddComment = useCallback(
    () => {
      const current = draft ?? task;
      if (!current) {
        return;
      }

      const trimmed = newComment.trim();
      if (!trimmed) {
        return;
      }

      const previousValue = newComment;
      const nextComment: TaskComment = {
        id: createRandomId(),
        author: "Вы",
        message: trimmed,
        createdAt: new Date().toISOString(),
      };

      const nextComments = [...(current.comments ?? []), nextComment];
      setNewComment("");

      runTaskUpdate(
        { comments: nextComments },
        {
          successMessage: "Комментарий добавлен",
          errorMessage: "Не удалось сохранить комментарий",
          toastErrorMessage: "Ошибка при сохранении комментария",
          onError: () => setNewComment(previousValue),
        },
      );
    },
    [draft, newComment, runTaskUpdate, task],
  );

  if (!isOpen || !draft) {
    return null;
  }

  const checklistCompleted = draft.checklist?.filter((item) => item.completed).length ?? 0;
  const checklistTotal = draft.checklist?.length ?? 0;

  return (
    <Fragment>
      <div className="fixed inset-0 z-40 bg-slate-900/30" aria-hidden="true" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Детали задачи ${draft.title}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl transition-transform dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Задача</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{draft.title}</h3>
          </div>
          <div className="flex items-start gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusConfig[draft.status].badge}`}>
              {statusConfig[draft.status].label}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Закрыть панель"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {banner && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
              <div className="flex items-start justify-between gap-4">
                <p>{banner.message}</p>
                <button
                  type="button"
                  onClick={() => setBanner(null)}
                  className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-200"
                >
                  Скрыть
                </button>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Быстрые действия</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-500" htmlFor="task-status-select">
                  Статус
                </label>
                <select
                  id="task-status-select"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={draft.status}
                  onChange={(event) => handleStatusChange(event.target.value as TaskStatus)}
                  disabled={updateTaskMutation.isPending}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-500" htmlFor="task-owner-select">
                  Исполнитель
                </label>
                <select
                  id="task-owner-select"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={draft.owner}
                  onChange={(event) => handleOwnerChange(event.target.value)}
                  disabled={updateTaskMutation.isPending || ownerOptions.length === 0}
                >
                  {ownerOptions.length === 0 && <option value="">Нет доступных исполнителей</option>}
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Описание</h4>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {draft.description?.trim() ? draft.description : "Описание отсутствует"}
            </p>
            <dl className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">Срок</dt>
                <dd className="mt-1 text-slate-600 dark:text-slate-300">
                  {dateFormatter.format(new Date(draft.dueDate))}
                </dd>
              </div>
              {draft.reminderAt && (
                <div>
                  <dt className="font-semibold text-slate-500">Напоминание</dt>
                  <dd className="mt-1 text-slate-600 dark:text-slate-300">
                    {dateFormatter.format(new Date(draft.reminderAt))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-slate-500">Тип</dt>
                <dd className="mt-1 capitalize text-slate-600 dark:text-slate-300">{draft.type}</dd>
              </div>
              {draft.tags.length > 0 && (
                <div>
                  <dt className="font-semibold text-slate-500">Теги</dt>
                  <dd className="mt-1 flex flex-wrap gap-1 text-slate-600 dark:text-slate-300">
                    {draft.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        #{tag}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {draft.dealId && (
                <div>
                  <dt className="font-semibold text-slate-500">Сделка</dt>
                  <dd className="mt-1">
                    <Link href={`/deals/${draft.dealId}`} className="text-sm font-medium text-sky-600 hover:underline">
                      Открыть сделку
                    </Link>
                  </dd>
                </div>
              )}
              {draft.clientId && (
                <div>
                  <dt className="font-semibold text-slate-500">Клиент</dt>
                  <dd className="mt-1 text-sm text-slate-600 dark:text-slate-300">{draft.clientId}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Чек-лист</h4>
              {checklistTotal > 0 && (
                <span className="text-xs text-slate-500">
                  {checklistCompleted}/{checklistTotal} выполнено
                </span>
              )}
            </div>
            {checklistTotal === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                Чек-лист отсутствует
              </p>
            ) : (
              <ul className="space-y-2">
                {draft.checklist?.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <input
                      id={`check-${item.id}`}
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={item.completed}
                      onChange={(event) => handleChecklistToggle(item.id, event.target.checked)}
                      disabled={updateTaskMutation.isPending}
                    />
                    <label htmlFor={`check-${item.id}`} className={`text-sm leading-tight ${item.completed ? "text-slate-400 line-through" : "text-slate-600 dark:text-slate-200"}`}>
                      {item.label}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Комментарии</h4>
            <div className="space-y-3">
              {(draft.comments?.length ?? 0) === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                  Комментарии отсутствуют
                </p>
              ) : (
                <ul className="space-y-3">
                  {draft.comments?.map((comment) => (
                    <li key={comment.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium text-slate-600 dark:text-slate-200">{comment.author}</span>
                        <time dateTime={comment.createdAt} className="text-slate-400">
                          {dateFormatter.format(new Date(comment.createdAt))}
                        </time>
                      </div>
                      <p className="mt-2 text-slate-600 dark:text-slate-200">{comment.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <label htmlFor="task-new-comment" className="text-xs font-medium text-slate-500">
                Добавить комментарий
              </label>
              <textarea
                id="task-new-comment"
                rows={3}
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Поделитесь обновлениями по задаче"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={newComment.trim().length === 0 || updateTaskMutation.isPending}
                  className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </section>
        </div>
      </aside>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {toast.message}
        </div>
      )}
    </Fragment>
  );
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    tags: [...task.tags],
    checklist: task.checklist ? task.checklist.map((item) => ({ ...item })) : undefined,
    comments: task.comments ? task.comments.map((comment) => ({ ...comment })) : undefined,
  };
}

function mergeTask(task: Task, payload: UpdateTaskPayload): Task {
  const tags = payload.tags !== undefined ? [...payload.tags] : [...task.tags];
  const checklist: TaskChecklistItem[] | undefined =
    payload.checklist !== undefined
      ? payload.checklist.map((item) => ({ ...item }))
      : task.checklist
      ? task.checklist.map((item) => ({ ...item }))
      : undefined;
  const comments: TaskComment[] | undefined =
    payload.comments !== undefined
      ? payload.comments.map((comment) => ({ ...comment }))
      : task.comments
      ? task.comments.map((comment) => ({ ...comment }))
      : undefined;

  return {
    ...task,
    ...payload,
    tags,
    checklist,
    comments,
  };
}

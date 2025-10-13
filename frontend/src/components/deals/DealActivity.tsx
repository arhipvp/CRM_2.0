"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  dealActivityQueryOptions,
  dealNotesQueryOptions,
  dealQueryOptions,
  dealStageMetricsQueryKey,
  dealsQueryKey,
} from "@/lib/api/queries";
import { useCreateDealNote, useDealActivity, useDealNotes } from "@/lib/api/hooks";
import type { ActivityLogEntry, DealNote } from "@/types/crm";

interface DealActivityProps {
  dealId: string;
  createRequestKey?: string;
  onCreateHandled?: () => void;
}

type TimelineEntry =
  | (ActivityLogEntry & { kind: "activity" })
  | (DealNote & { kind: "note" });

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DealActivity({ dealId, createRequestKey, onCreateHandled }: DealActivityProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();
  const { data: notes = [], isLoading: notesLoading } = useDealNotes(dealId);
  const { data: activity = [], isLoading: activityLoading } = useDealActivity(dealId);
  const { mutateAsync: createNote, isPending } = useCreateDealNote(dealId);

  const notesKey = useMemo(() => dealNotesQueryOptions(dealId).queryKey, [dealId]);
  const activityKey = useMemo(() => dealActivityQueryOptions(dealId).queryKey, [dealId]);
  const dealKey = useMemo(() => dealQueryOptions(dealId).queryKey, [dealId]);

  useEffect(() => {
    if (createRequestKey) {
      setIsComposerOpen(true);
      onCreateHandled?.();
    }
  }, [createRequestKey, onCreateHandled]);

  useEffect(() => {
    if (!isComposerOpen) {
      setContent("");
    }
  }, [isComposerOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }

    await createNote({ content: content.trim() });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notesKey }),
      queryClient.invalidateQueries({ queryKey: activityKey }),
      queryClient.invalidateQueries({ queryKey: dealKey, exact: true }),
      queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
      queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey }),
    ]);

    setIsComposerOpen(false);
    setContent("");
  };

  const entries = useMemo<TimelineEntry[]>(() => {
    const timeline: TimelineEntry[] = [
      ...activity.map((item) => ({ ...item, kind: "activity" as const })),
      ...notes.map((item) => ({ ...item, kind: "note" as const })),
    ];

    return timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activity, notes]);

  const isLoading = notesLoading || activityLoading;

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Журнал активности</h2>
        <button
          type="button"
          onClick={() => setIsComposerOpen((prev) => !prev)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          {isComposerOpen ? "Скрыть" : "Добавить заметку"}
        </button>
      </header>

      {isComposerOpen && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Заметка</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Зафиксируйте следующую коммуникацию"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">Записей пока нет, добавьте первую заметку.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li
              key={`${entry.kind}-${entry.id}`}
              className="rounded-lg border border-slate-200 p-4 shadow-sm transition hover:border-sky-200 dark:border-slate-700 dark:hover:border-sky-500/60"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {entry.kind === "note" ? "Заметка" : `Событие · ${entry.type}`}
                  </span>
                  <span>{entry.author}</span>
                </div>
                <time className="text-xs text-slate-400">{formatDate(entry.createdAt)}</time>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {entry.kind === "note" ? entry.content : entry.message}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dealDocumentsQueryOptions, dealDetailsQueryOptions, dealsQueryKey } from "@/lib/api/queries";
import { useDealDocuments, useUploadDealDocument } from "@/lib/api/hooks";
import type { DealDocument } from "@/types/crm";

interface DealDocumentsProps {
  dealId: string;
  createRequestKey?: string;
  onCreateHandled?: () => void;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes)) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} Б`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function sortDocuments(documents: DealDocument[]): DealDocument[] {
  return [...documents].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DealDocuments({ dealId, createRequestKey, onCreateHandled }: DealDocumentsProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [url, setUrl] = useState("");
  const { data: documents = [], isLoading } = useDealDocuments(dealId);
  const { mutateAsync: uploadDocument, isPending } = useUploadDealDocument(dealId);
  const queryClient = useQueryClient();

  const documentsKey = useMemo(() => dealDocumentsQueryOptions(dealId).queryKey, [dealId]);
  const dealDetailsKey = useMemo(() => dealDetailsQueryOptions(dealId).queryKey, [dealId]);

  useEffect(() => {
    if (createRequestKey) {
      setIsFormOpen(true);
      onCreateHandled?.();
    }
  }, [createRequestKey, onCreateHandled]);

  useEffect(() => {
    if (!isFormOpen) {
      setTitle("");
      setFileName("");
      setFileSize("");
      setUrl("");
    }
  }, [isFormOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !fileName.trim()) {
      return;
    }

    const normalizedSize = Number.parseInt(fileSize, 10);

    await uploadDocument({
      title: title.trim(),
      fileName: fileName.trim(),
      fileSize: Number.isFinite(normalizedSize) ? normalizedSize : 0,
      url: url.trim() || undefined,
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: documentsKey }),
      queryClient.invalidateQueries({ queryKey: dealDetailsKey, exact: true }),
      queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
    ]);

    setIsFormOpen(false);
  };

  const visibleDocuments = useMemo(() => sortDocuments(documents), [documents]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Документы</h2>
        <button
          type="button"
          onClick={() => setIsFormOpen((prev) => !prev)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          {isFormOpen ? "Скрыть" : "Загрузить файл"}
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
              placeholder="Коммерческое предложение"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Имя файла</label>
              <input
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="document.pdf"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Размер (Б)</label>
              <input
                value={fileSize}
                onChange={(event) => setFileSize(event.target.value.replace(/[^0-9]/g, ""))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="248000"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Ссылка для скачивания (опционально)</label>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="https://..."
            />
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
              disabled={isPending}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Загружаем..." : "Сохранить"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : visibleDocuments.length === 0 ? (
        <p className="text-sm text-slate-500">Документы ещё не загружены.</p>
      ) : (
        <ul className="space-y-3">
          {visibleDocuments.map((document) => (
            <li
              key={document.id}
              className="rounded-lg border border-slate-200 p-4 shadow-sm transition hover:border-sky-200 dark:border-slate-700 dark:hover:border-sky-500/60"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{document.title}</p>
                    <p className="text-xs text-slate-500">{document.fileName}</p>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {formatFileSize(document.fileSize)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>Загрузил: {document.uploadedBy}</span>
                  <span>{formatDate(document.uploadedAt)}</span>
                  {document.url && (
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 hover:underline"
                    >
                      Открыть
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

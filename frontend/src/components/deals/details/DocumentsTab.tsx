"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DealDocumentCategory, DealDocumentV2 } from "@/types/crm";

interface DocumentsTabProps {
  categories: DealDocumentCategory[];
  onUpload?: (files: FileList) => void;
  highlightKey?: string;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatSize(size: number) {
  if (size < 1024) {
    return `${size} Б`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} КБ`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function ReviewBadge({ status }: { status: DealDocumentV2["reviewStatus"] }) {
  const tone =
    status === "approved"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
      : status === "rejected"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
        : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200";

  const label =
    status === "approved" ? "Проверен" : status === "rejected" ? "Отклонён" : "Ожидает проверки";

  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

function DocumentCard({ document }: { document: DealDocumentV2 }) {
  return (
    <li className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{document.name}</p>
          <p className="text-xs text-slate-500">{document.type} · {formatSize(document.size)}</p>
        </div>
        <ReviewBadge status={document.reviewStatus} />
      </div>
      <p className="text-xs text-slate-500">Загружено: {formatDate(document.uploadedAt)} · {document.uploadedBy}</p>
      {document.reviewComment ? (
        <p className="text-xs text-slate-500">Комментарий проверки: {document.reviewComment}</p>
      ) : null}
      <div>
        <p className="text-xs font-semibold text-slate-500">Версии</p>
        <ul className="mt-2 space-y-2 text-xs text-slate-500">
          {document.versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 dark:border-slate-700">
              <span>
                v{version.version} · {formatDate(version.uploadedAt)}
              </span>
              <span>{version.uploadedBy}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <button type="button" className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Скачать
        </button>
        <button type="button" className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Новая версия
        </button>
        <button type="button" className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Изменить категорию
        </button>
      </div>
    </li>
  );
}

export function DocumentsTab({ categories, onUpload, highlightKey }: DocumentsTabProps) {
  const [isDragging, setDragging] = useState(false);
  const [isHighlighted, setHighlighted] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filesCount = useMemo(() => categories.reduce((acc, category) => acc + category.documents.length, 0), [categories]);

  useEffect(() => {
    if (!highlightKey) {
      return;
    }
    setHighlighted(true);
    const timeout = window.setTimeout(() => setHighlighted(false), 1200);
    return () => window.clearTimeout(timeout);
  }, [highlightKey]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onUpload?.(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  };

  return (
    <section className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
          isDragging || isHighlighted
            ? "border-sky-400 bg-sky-50 text-sky-600 dark:border-sky-600 dark:bg-sky-900/20 dark:text-sky-200"
            : "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-300"
        }`}
      >
        <p className="text-sm font-semibold">Перетащите файлы сюда или выберите вручную</p>
        <p className="text-xs text-slate-400">PDF, DOCX, XLSX, JPG, PNG до 100 МБ</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Выбрать файлы
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              onUpload?.(event.target.files);
            }
          }}
        />
      </div>

      {filesCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
          Документы ещё не загружены. Добавьте первый файл, чтобы продолжить оформление сделки.
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <section key={category.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{category.title}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {category.documents.length} фай{category.documents.length === 1 ? "л" : category.documents.length < 5 ? "ла" : "лов"}
                </span>
              </header>
              {category.documents.length === 0 ? (
                <p className="text-xs text-slate-500">Файлы этой категории ещё не загружены.</p>
              ) : (
                <ul className="space-y-3">
                  {category.documents.map((document) => (
                    <DocumentCard key={document.id} document={document} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

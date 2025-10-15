"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DOCUMENT_CATEGORY_PRESET, changeDealDocumentCategory, uploadDealDocument } from "@/lib/api/documents";
import type { DealDocumentCategory, DealDocumentV2 } from "@/types/crm";

interface DocumentsTabProps {
  dealId?: string;
  categories: DealDocumentCategory[];
  onUpload?: (files: FileList) => void;
  highlightKey?: string;
}

type UploadStatus = "queued" | "uploading" | "success" | "error" | "canceled";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
  document?: DealDocumentV2;
}

interface CategoryDialogRequest {
  id: string;
  document: DealDocumentV2;
  origin: "upload" | "existing";
  uploadId?: string;
  previousCategoryId?: string;
}

const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

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

function DocumentActions({
  onChangeCategory,
  onClose,
}: {
  onChangeCategory: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => {
          onChangeCategory();
          onClose();
        }}
      >
        Изменить категорию
      </button>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs text-slate-600 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={onClose}
      >
        Закрыть
      </button>
    </div>
  );
}

function DocumentCard({ document, onChangeCategory }: { document: DealDocumentV2; onChangeCategory: (document: DealDocumentV2) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li className="relative space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 dark:border-slate-700 dark:bg-slate-900/80">
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
        {document.url ? (
          <a
            href={document.url}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Скачать
          </a>
        ) : (
          <span className="rounded border border-dashed border-slate-200 px-2 py-1 text-slate-400">Ссылка недоступна</span>
        )}
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Новая версия
        </button>
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="rounded border border-slate-200 px-2 py-1 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            ⋯
          </button>
          {menuOpen ? (
            <DocumentActions
              onChangeCategory={() => onChangeCategory(document)}
              onClose={() => setMenuOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}

function UploadQueueItem({
  item,
  onCancel,
  onRetry,
  onAssign,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onAssign: (item: UploadItem) => void;
}) {
  const statusTone =
    item.status === "error"
      ? "text-rose-600 dark:text-rose-300"
      : item.status === "canceled"
        ? "text-slate-400"
        : item.status === "success"
          ? "text-emerald-600 dark:text-emerald-300"
          : "text-slate-500";

  const statusLabel =
    item.status === "queued"
      ? "В очереди"
      : item.status === "uploading"
        ? "Загрузка"
        : item.status === "success"
          ? "Загружено, выберите категорию"
          : item.status === "canceled"
            ? "Отменено"
            : "Ошибка";

  return (
    <li className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.file.name}</p>
          <p className={`text-xs ${statusTone}`}>{item.error ?? statusLabel}</p>
        </div>
        <span className="text-xs text-slate-500">{formatSize(item.file.size)}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full transition-all ${
            item.status === "error"
              ? "bg-rose-400"
              : item.status === "success"
                ? "bg-emerald-500"
                : item.status === "canceled"
                  ? "bg-slate-300"
                  : "bg-sky-500"
          }`}
          style={{ width: `${item.status === "canceled" ? 0 : item.progress}%` }}
        />
      </div>
      <div className="flex justify-end gap-2 text-xs">
        {item.status === "uploading" || item.status === "queued" ? (
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => onCancel(item.id)}
          >
            Отменить
          </button>
        ) : null}
        {item.status === "error" ? (
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => onRetry(item.id)}
          >
            Повторить
          </button>
        ) : null}
        {item.status === "success" ? (
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => onAssign(item)}
          >
            Назначить категорию
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function DocumentsTab({ dealId, categories, onUpload, highlightKey }: DocumentsTabProps) {
  const [isDragging, setDragging] = useState(false);
  const [isHighlighted, setHighlighted] = useState(false);
  const [categoryState, setCategoryState] = useState<DealDocumentCategory[]>(categories);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [validationHints, setValidationHints] = useState<string[]>([]);
  const [categoryQueue, setCategoryQueue] = useState<CategoryDialogRequest[]>([]);
  const [activeCategoryRequest, setActiveCategoryRequest] = useState<CategoryDialogRequest | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const startedUploads = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    setCategoryState(categories);
  }, [categories]);

  useEffect(() => {
    if (!highlightKey) {
      return;
    }
    setHighlighted(true);
    const timeout = window.setTimeout(() => setHighlighted(false), 1200);
    return () => window.clearTimeout(timeout);
  }, [highlightKey]);

  const filesCount = useMemo(
    () =>
      categoryState.reduce((acc, category) => acc + category.documents.length, 0) +
      queue.filter((item) => item.status !== "success" && item.status !== "canceled").length,
    [categoryState, queue],
  );

  const enqueueUpload = (files: FileList) => {
    const nextQueue: UploadItem[] = [];
    const hints: string[] = [];

    Array.from(files).forEach((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        hints.push(`Файл «${file.name}» имеет неподдерживаемый формат. Разрешены: PDF, DOCX, XLS(X), JPG/PNG.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        hints.push(`Файл «${file.name}» превышает лимит 100 МБ (${formatSize(file.size)}).`);
        return;
      }

      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      nextQueue.push({ id, file, progress: 0, status: "queued" });
    });

    if (hints.length > 0) {
      setValidationHints((prev) => Array.from(new Set([...prev, ...hints])));
    }

    if (nextQueue.length > 0) {
      setQueue((prev) => [...prev, ...nextQueue]);
    }
  };

  const startUpload = (item: UploadItem) => {
    if (!dealId) {
      setQueue((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? { ...current, status: "error", error: "Не указан идентификатор сделки для загрузки" }
            : current,
        ),
      );
      return;
    }

    const controller = new AbortController();
    controllers.current.set(item.id, controller);

    setQueue((prev) => prev.map((current) => (current.id === item.id ? { ...current, status: "uploading", error: undefined } : current)));

    uploadDealDocument({
      dealId,
      file: item.file,
      signal: controller.signal,
      onProgress: (value) => {
        setQueue((prev) => prev.map((current) => (current.id === item.id ? { ...current, progress: value } : current)));
      },
    })
      .then((document) => {
        setQueue((prev) =>
          prev.map((current) => (current.id === item.id ? { ...current, status: "success", progress: 100, document } : current)),
        );
        setCategoryQueue((prev) => [
          ...prev,
          {
            id: document.id,
            document,
            origin: "upload",
            uploadId: item.id,
          },
        ]);
      })
      .catch((error) => {
        const isAborted = error instanceof DOMException && error.name === "AbortError";
        setQueue((prev) =>
          prev.map((current) =>
            current.id === item.id
              ? {
                  ...current,
                  status: isAborted ? "canceled" : "error",
                  error: isAborted ? "Загрузка отменена" : error instanceof Error ? error.message : "Не удалось загрузить файл",
                }
              : current,
          ),
        );
      })
      .finally(() => {
        controllers.current.delete(item.id);
        startedUploads.current.delete(item.id);
      });
  };

  useEffect(() => {
    queue.forEach((item) => {
      if (item.status === "queued" && !startedUploads.current.has(item.id)) {
        startedUploads.current.add(item.id);
        startUpload(item);
      }
    });
  }, [queue]);

  useEffect(() => {
    if (activeCategoryRequest || categoryQueue.length === 0) {
      return;
    }

    setActiveCategoryRequest(categoryQueue[0]);
  }, [categoryQueue, activeCategoryRequest]);

  useEffect(() => {
    if (!activeCategoryRequest) {
      return;
    }

    const current = categoryState.find((category) =>
      category.documents.some((document) => document.id === activeCategoryRequest.document.id),
    );

    if (current) {
      setSelectedCategoryId(current.id);
    } else {
      const preset = DOCUMENT_CATEGORY_PRESET.find((option) => option.title === activeCategoryRequest.document.category);
      setSelectedCategoryId(preset?.id ?? DOCUMENT_CATEGORY_PRESET[0].id);
    }
  }, [activeCategoryRequest, categoryState]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      enqueueUpload(event.dataTransfer.files);
      onUpload?.(event.dataTransfer.files);
      event.dataTransfer.clearData();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      enqueueUpload(event.target.files);
      onUpload?.(event.target.files);
      event.target.value = "";
    }
  };

  const handleCancelUpload = (id: string) => {
    controllers.current.get(id)?.abort();
  };

  const handleRetry = (id: string) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, status: "queued", error: undefined, progress: 0 } : item)));
  };

  const closeCategoryDialog = () => {
    setActiveCategoryRequest(null);
    setCategoryQueue((prev) => prev.slice(1));
    setSelectedCategoryId(undefined);
  };

  const saveCategory = async () => {
    if (!activeCategoryRequest || !selectedCategoryId) {
      return;
    }

    const category = categoryState.find((option) => option.id === selectedCategoryId);
    if (!category) {
      return;
    }

    try {
      await changeDealDocumentCategory({ documentId: activeCategoryRequest.document.id, categoryId: selectedCategoryId });

      setCategoryState((prev) => {
        const withoutDocument = prev.map((item) => ({
          ...item,
          documents: item.documents.filter((doc) => doc.id !== activeCategoryRequest.document.id),
        }));

        return withoutDocument.map((item) =>
          item.id === category.id
            ? {
                ...item,
                documents: [
                  ...item.documents,
                  {
                    ...activeCategoryRequest.document,
                    category: category.title,
                  },
                ],
              }
            : item,
        );
      });

      if (activeCategoryRequest.origin === "upload" && activeCategoryRequest.uploadId) {
        setQueue((prev) => prev.filter((item) => item.id !== activeCategoryRequest.uploadId));
      }
    } finally {
      closeCategoryDialog();
    }
  };

  const handleDocumentCategoryChange = (document: DealDocumentV2) => {
    const currentCategory = categoryState.find((item) => item.documents.some((doc) => doc.id === document.id));
    setCategoryQueue((prev) => [
      ...prev,
      {
        id: document.id,
        document,
        origin: "existing",
        previousCategoryId: currentCategory?.id,
      },
    ]);
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
          aria-label="Загрузить документы"
          className="hidden"
          onChange={handleInputChange}
        />
        {validationHints.length > 0 ? (
          <ul className="mt-3 space-y-1 text-left text-xs text-rose-600 dark:text-rose-300">
            {validationHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {queue.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Загрузки</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {queue.length}
            </span>
          </header>
          <ul className="space-y-3">
            {queue.map((item) => (
              <UploadQueueItem
                key={item.id}
                item={item}
                onCancel={handleCancelUpload}
                onRetry={handleRetry}
                onAssign={(current) => {
                  const document = current.document;
                  if (!document) {
                    return;
                  }
                  const request: CategoryDialogRequest = {
                    id: document.id,
                    document,
                    origin: "upload",
                    uploadId: current.id,
                  };
                  setCategoryQueue((prev) => [
                    ...prev,
                    request,
                  ]);
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {filesCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
          Документы ещё не загружены. Добавьте первый файл, чтобы продолжить оформление сделки.
        </div>
      ) : (
        <div className="space-y-4">
          {categoryState.map((category) => (
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
                    <DocumentCard key={document.id} document={document} onChangeCategory={handleDocumentCategoryChange} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {activeCategoryRequest ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Выберите категорию</h2>
              <p className="text-xs text-slate-500">
                Файл «{activeCategoryRequest.document.name}» нужно отнести к одной из категорий. Это поможет команде быстро найти документ.
              </p>
            </header>
            <fieldset className="space-y-2">
              {DOCUMENT_CATEGORY_PRESET.map((category) => (
                <label
                  key={category.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:bg-slate-800"
                >
                  <span>{category.title}</span>
                  <input
                    type="radio"
                    name="document-category"
                    value={category.id}
                    checked={selectedCategoryId === category.id}
                    onChange={() => setSelectedCategoryId(category.id)}
                  />
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2 text-sm">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={closeCategoryDialog}
              >
                Позже
              </button>
              <button
                type="button"
                className="rounded-md bg-sky-600 px-3 py-1.5 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={saveCategory}
                disabled={!selectedCategoryId}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

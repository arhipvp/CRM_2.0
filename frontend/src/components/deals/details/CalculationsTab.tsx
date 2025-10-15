"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DealCalculation, DealCalculationStatus, DealQuickTag } from "@/types/crm";

export interface CalculationsTabProps {
  calculations: DealCalculation[];
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
}

type CalculationFilter = "active" | "confirmed" | "archived";

const FILTERS: Array<{ id: CalculationFilter; label: string; statuses: DealCalculationStatus[] }> = [
  { id: "active", label: "Активные", statuses: ["draft", "pending", "ready"] },
  { id: "confirmed", label: "Подтверждённые", statuses: ["confirmed"] },
  { id: "archived", label: "Архив", statuses: ["archived"] },
];

const STATUS_LABELS: Record<DealCalculationStatus, string> = {
  draft: "Черновик",
  pending: "На проверке",
  ready: "Готов",
  confirmed: "Подтверждён",
  archived: "Архив",
};

const STATUS_TONES: Record<DealCalculationStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
  ready: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200",
  archived: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const READY_CONFIRMATION_BADGE_TONE =
  "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/30";

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("ru-RU")} ${currency}`;
  }
}

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

function formatFileSize(size: number) {
  if (!Number.isFinite(size)) {
    return "—";
  }

  if (size < 1024) {
    return `${size} Б`;
  }

  const units = ["КБ", "МБ", "ГБ"];
  let unitIndex = 0;
  let value = size / 1024;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function QuickTagBadge({ tag }: { tag: DealQuickTag }) {
  const toneClass =
    {
      neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
      info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
      success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
      warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
      danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
    }[tag.tone ?? "neutral"] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass}`}>
      {tag.label}
    </span>
  );
}

export function CalculationsTab({ calculations, isLoading, error, onRetry }: CalculationsTabProps) {
  const [filter, setFilter] = useState<CalculationFilter>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(420);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!dragState.current) {
      return;
    }
    const delta = dragState.current.startX - event.clientX;
    const nextWidth = Math.min(Math.max(dragState.current.startWidth + delta, 320), 640);
    setPanelWidth(nextWidth);
  }, []);

  const stopDragging = useCallback(() => {
    dragState.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDragging);
  }, [handlePointerMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [handlePointerMove, stopDragging]);

  const filteredCalculations = useMemo(() => {
    const filterConfig = FILTERS.find((item) => item.id === filter);
    const allowedStatuses = filterConfig ? filterConfig.statuses : FILTERS[0].statuses;
    const normalizedQuery = search.trim().toLowerCase();

    return calculations
      .filter((calc) => allowedStatuses.includes(calc.status))
      .filter((calc) => {
        if (!normalizedQuery) {
          return true;
        }
        const haystack = `${calc.insurer} ${calc.program}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const left = new Date(a.updatedAt).getTime();
        const right = new Date(b.updatedAt).getTime();
        if (Number.isNaN(left) || Number.isNaN(right)) {
          return 0;
        }
        return right - left;
      });
  }, [calculations, filter, search]);

  const selectedCalculation = useMemo(
    () => calculations.find((calc) => calc.id === selectedId) ?? null,
    [calculations, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const stillVisible = filteredCalculations.some((calc) => calc.id === selectedId);
    if (!stillVisible) {
      setSelectedId(null);
    }
  }, [filteredCalculations, selectedId]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragState.current = { startX: event.clientX, startWidth: panelWidth };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDragging);
    },
    [handlePointerMove, panelWidth, stopDragging],
  );

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3" aria-live="polite">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/80"
            />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
          <p>Не удалось загрузить расчёты. {error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-400"
            >
              Повторить попытку
            </button>
          ) : null}
        </div>
      );
    }

    if (calculations.length === 0) {
      return (
        <div className="space-y-3 rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70">
          <p>Расчёты ещё не добавлены. Создайте первый вариант, чтобы предложить клиенту страховую программу.</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Создать расчёт
            </button>
            <a
              href="/docs/frontend/calculations"
              className="rounded-md border border-transparent px-3 py-1.5 font-medium text-sky-600 transition hover:text-sky-500"
            >
              Инструкция по подготовке
            </a>
          </div>
        </div>
      );
    }

    if (filteredCalculations.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70">
          По запросу «{search}» расчёты не найдены. Попробуйте изменить фильтр или сбросить поиск.
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50/80 dark:bg-slate-800/80">
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Страховая компания
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Программа
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Премия
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Период действия
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Статус
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Полис
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Обновлено
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredCalculations.map((calc) => {
              const isSelected = calc.id === selectedId;
              return (
                <tr
                  key={calc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(calc.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(calc.id);
                    }
                  }}
                  className={`cursor-pointer bg-white transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-slate-900/80 dark:hover:bg-slate-800 ${
                    isSelected ? "bg-sky-50/70 dark:bg-sky-900/20" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {calc.insurer}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{calc.program}</span>
                      {calc.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {calc.tags.map((tag) => (
                            <QuickTagBadge key={tag.id} tag={tag} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {formatCurrency(calc.premium, calc.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{calc.period}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[calc.status]}`}
                      >
                        {STATUS_LABELS[calc.status]}
                      </span>
                      {calc.status === "ready" ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${READY_CONFIRMATION_BADGE_TONE}`}
                        >
                          Ожидает подтверждения
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {calc.policyId ? (
                      <Link href={`/policies/${calc.policyId}`} className="text-sky-600 hover:underline">
                        Перейти
                      </Link>
                    ) : (
                      <span className="text-slate-400">Не привязан</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatDate(calc.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(calc.id);
                        }}
                      >
                        Открыть
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        onClick={(event) => {
                          event.stopPropagation();
                          console.info("Дублирование расчёта", calc.id);
                        }}
                      >
                        Дублировать
                      </button>
                      {calc.status === "ready" ? (
                        <button
                          type="button"
                          className="rounded-md border border-emerald-500 px-2 py-1 font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-900/30"
                          onClick={(event) => {
                            event.stopPropagation();
                            console.info("Подтверждение расчёта", calc.id);
                          }}
                        >
                          Подтвердить
                        </button>
                      ) : null}
                      {calc.status !== "archived" ? (
                        <button
                          type="button"
                          className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:hover:border-rose-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-200"
                          onClick={(event) => {
                            event.stopPropagation();
                            console.info("Архивирование расчёта", calc.id);
                          }}
                        >
                          В архив
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="relative">
      <div
        className="space-y-4"
        style={selectedCalculation ? { marginRight: panelWidth + 24 } : undefined}
      >
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === item.id
                    ? "border-sky-600 bg-sky-50 text-sky-600 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-200"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300">
              <span className="hidden lg:inline">Поиск:</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Страховая или программа"
                className="w-48 border-none bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-200"
              />
            </label>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Добавить расчёт
            </button>
          </div>
        </header>

        <div className="text-xs text-slate-500">
          Показано {filteredCalculations.length} из {calculations.length} расчётов
        </div>

        {renderTableContent()}
      </div>

      {selectedCalculation ? (
        <aside
          className="absolute top-0 right-0 flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95"
          style={{ width: panelWidth, minHeight: 420 }}
          aria-label={`Детали расчёта ${selectedCalculation.program}`}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-xl bg-transparent"
            onPointerDown={handlePointerDown}
          >
            <span className="absolute left-0 top-1/2 h-16 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <header className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedCalculation.program}</h3>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Закрыть
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-300">{selectedCalculation.insurer}</p>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[selectedCalculation.status]}`}>
                {STATUS_LABELS[selectedCalculation.status]}
              </span>
              {selectedCalculation.tags.map((tag) => (
                <QuickTagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          </header>

          <dl className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Премия</dt>
              <dd className="text-base font-semibold text-slate-900 dark:text-white">
                {formatCurrency(selectedCalculation.premium, selectedCalculation.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Период действия</dt>
              <dd>{selectedCalculation.period}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Последнее обновление</dt>
              <dd>{formatDate(selectedCalculation.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Связанный полис</dt>
              <dd>
                {selectedCalculation.policyId ? (
                  <Link href={`/policies/${selectedCalculation.policyId}`} className="text-sky-600 hover:underline">
                    Открыть полис
                  </Link>
                ) : (
                  <span className="text-slate-400">Не привязан</span>
                )}
              </dd>
            </div>
          </dl>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Файлы расчёта</h4>
            {selectedCalculation.files.length === 0 ? (
              <p className="text-xs text-slate-500">Файлы ещё не загружены.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {selectedCalculation.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                      <p className="text-xs text-slate-500">
                        Загружено: {formatDate(file.uploadedAt)} · {file.uploadedBy}
                      </p>
                    </div>
                    {file.url ? (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Скачать
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 text-xs text-slate-500">
            <p>
              Подготовьте сопроводительное письмо для клиента и проверьте, заполнены ли обязательные поля. Статус «Готов» потребует хотя бы одного файла.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => console.info("Редактирование расчёта", selectedCalculation.id)}
              >
                Редактировать
              </button>
              <button
                type="button"
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
                onClick={() => console.info("Экспорт расчёта", selectedCalculation.id)}
              >
                Экспортировать PDF
              </button>
            </div>
          </section>
        </aside>
      ) : null}
    </section>
  );
}

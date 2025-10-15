"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  useAdminDictionaries,
  useCreateAdminDictionaryEntry,
  useDeleteAdminDictionaryEntry,
  useUpdateAdminDictionaryEntry,
} from "@/lib/api/admin/hooks";
import { createCsv, createJson, triggerDownload } from "@/lib/utils/export";
import {
  mapDictionaryFilters,
  useAdminFiltersStore,
} from "@/stores/adminFiltersStore";
import { useHasAdminPermission } from "@/stores/adminAccessStore";
import type { AdminDictionaryEntry, AdminDictionaryKind, UpsertDictionaryPayload } from "@/types/admin";

const dictionaryKindOptions: Array<{ value: AdminDictionaryKind | "all"; label: string }> = [
  { value: "all", label: "Все справочники" },
  { value: "dealTypes", label: "Типы сделок" },
  { value: "taskStatuses", label: "Статусы задач" },
  { value: "policyStatuses", label: "Статусы полисов" },
  { value: "taskTags", label: "Теги задач" },
];

interface DictionaryFormState {
  kind: AdminDictionaryKind;
  code: string;
  label: string;
  description: string;
  isActive: boolean;
}

function validateDictionaryForm(values: DictionaryFormState) {
  const errors: Partial<Record<keyof DictionaryFormState, string>> = {};

  if (!values.code.trim()) {
    errors.code = "Укажите уникальный код";
  }

  if (!values.label.trim()) {
    errors.label = "Укажите отображаемое название";
  }

  return errors;
}

export function DictionaryEditor() {
  const canManageDictionaries = useHasAdminPermission("manage:dictionaries");
  const dictionaryFilters = useAdminFiltersStore((state) => state.dictionaryFilters);
  const setDictionaryKind = useAdminFiltersStore((state) => state.setDictionaryKind);
  const setDictionarySearch = useAdminFiltersStore((state) => state.setDictionarySearch);
  const clearDictionaryFilters = useAdminFiltersStore((state) => state.clearDictionaryFilters);

  const queryFilters = useMemo(() => mapDictionaryFilters(dictionaryFilters), [dictionaryFilters]);

  const dictionariesQuery = useAdminDictionaries(queryFilters);
  const createEntry = useCreateAdminDictionaryEntry();
  const updateEntry = useUpdateAdminDictionaryEntry();
  const deleteEntry = useDeleteAdminDictionaryEntry();

  const [isCreating, setIsCreating] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<DictionaryFormState>({
    kind: "dealTypes",
    code: "",
    label: "",
    description: "",
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DictionaryFormState, string>>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const entries = dictionariesQuery.data ?? [];
  const isMutating = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  const handleStartCreate = () => {
    setFeedback(null);
    setRequestError(null);
    setFormErrors({});
    setEditingEntryId(null);
    setFormValues({
      kind: (dictionaryFilters.kind !== "all" ? dictionaryFilters.kind : "dealTypes") as AdminDictionaryKind,
      code: "",
      label: "",
      description: "",
      isActive: true,
    });
    setIsCreating(true);
  };

  const handleEdit = (entry: AdminDictionaryEntry) => {
    setFeedback(null);
    setRequestError(null);
    setFormErrors({});
    setIsCreating(false);
    setEditingEntryId(entry.id);
    setFormValues({
      kind: entry.kind,
      code: entry.code,
      label: entry.label,
      description: entry.description ?? "",
      isActive: entry.isActive,
    });
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingEntryId(null);
    setFormValues({
      kind: "dealTypes",
      code: "",
      label: "",
      description: "",
      isActive: true,
    });
    setFormErrors({});
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleChange = (field: keyof DictionaryFormState, value: string | boolean) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setRequestError(null);
    const errors = validateDictionaryForm(formValues);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload: UpsertDictionaryPayload = {
      code: formValues.code.trim(),
      label: formValues.label.trim(),
      description: formValues.description.trim(),
      isActive: formValues.isActive,
    };

    try {
      if (editingEntryId) {
        await updateEntry.mutateAsync({ entryId: editingEntryId, payload });
        setFeedback("Запись обновлена");
      } else {
        await createEntry.mutateAsync({ kind: formValues.kind, payload });
        setFeedback("Запись добавлена в справочник");
      }
      resetForm();
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError(error.message);
      } else if (error instanceof Error) {
        setRequestError(error.message);
      } else {
        setRequestError("Не удалось сохранить запись");
      }
    }
  };

  const handleDelete = async (entry: AdminDictionaryEntry) => {
    setFeedback(null);
    setRequestError(null);
    if (!window.confirm(`Удалить запись ${entry.label}?`)) {
      return;
    }

    try {
      await deleteEntry.mutateAsync({ entryId: entry.id });
      setFeedback("Запись удалена");
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError(error.message);
      } else if (error instanceof Error) {
        setRequestError(error.message);
      } else {
        setRequestError("Не удалось удалить запись");
      }
    }
  };

  const handleToggleActive = async (entry: AdminDictionaryEntry) => {
    setFeedback(null);
    setRequestError(null);
    try {
      await updateEntry.mutateAsync({
        entryId: entry.id,
        payload: { isActive: !entry.isActive },
      });
      setFeedback("Статус справочника обновлён");
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError(error.message);
      } else if (error instanceof Error) {
        setRequestError(error.message);
      } else {
        setRequestError("Не удалось обновить запись");
      }
    }
  };

  const handleExport = (format: "csv" | "json") => {
    if (entries.length === 0) {
      return;
    }

    const stamp = new Date().toISOString().split("T")[0];
    if (format === "json") {
      const content = createJson(
        entries.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          code: entry.code,
          label: entry.label,
          description: entry.description,
          isActive: entry.isActive,
          updatedAt: entry.updatedAt,
          updatedBy: entry.updatedBy,
        })),
      );
      triggerDownload({
        fileName: `admin-dictionaries-${stamp}.json`,
        content,
        mimeType: "application/json",
      });
      return;
    }

    const headers = ["Категория", "Код", "Название", "Описание", "Статус", "Обновлено", "Автор"];
    const rows = entries.map((entry) => [
      dictionaryKindOptions.find((option) => option.value === entry.kind)?.label ?? entry.kind,
      entry.code,
      entry.label,
      entry.description ?? "",
      entry.isActive ? "Активен" : "Выключен",
      entry.updatedAt,
      entry.updatedBy,
    ]);
    const content = createCsv(headers, rows);
    triggerDownload({
      fileName: `admin-dictionaries-${stamp}.csv`,
      content,
      mimeType: "text/csv",
    });
  };

  return (
    <section aria-labelledby="admin-dictionary-editor" className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="admin-dictionary-editor" className="text-xl font-semibold text-slate-900 dark:text-white">
              Справочники CRM
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Обновляйте статусы и теги без релизов. Изменения сразу доступны во всех формах.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              onClick={() => handleExport("json")}
              disabled={entries.length === 0}
            >
              Экспорт JSON
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              onClick={() => handleExport("csv")}
              disabled={entries.length === 0}
            >
              Экспорт CSV
            </button>
            <button
              type="button"
              onClick={handleStartCreate}
              disabled={!canManageDictionaries || isMutating}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Новая запись
            </button>
          </div>
        </div>
        {!canManageDictionaries && (
          <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            У вас нет прав на изменение справочников. Обратитесь к главному админу.
          </p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Справочник</span>
          <select
            value={dictionaryFilters.kind}
            onChange={(event) => setDictionaryKind(event.target.value as AdminDictionaryKind | "all")}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {dictionaryKindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Поиск</span>
          <input
            type="search"
            value={dictionaryFilters.search}
            onChange={(event) => setDictionarySearch(event.target.value)}
            placeholder="Код или название"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={clearDictionaryFilters}
          className="text-sm font-medium text-sky-600 hover:underline disabled:opacity-50"
          disabled={dictionaryFilters.kind === "all" && dictionaryFilters.search.length === 0}
        >
          Сбросить фильтры
        </button>
        {dictionariesQuery.isFetching && (
          <span role="status" className="text-xs text-slate-500 dark:text-slate-400">
            Обновляем данные…
          </span>
        )}
      </div>

      {(isCreating || editingEntryId) && (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
        >
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {editingEntryId ? "Редактирование записи" : "Новая запись"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {!editingEntryId && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Справочник</span>
                <select
                  value={formValues.kind}
                  onChange={(event) => handleChange("kind", event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {dictionaryKindOptions
                    .filter((option) => option.value !== "all")
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Код</span>
              <input
                type="text"
                value={formValues.code}
                onChange={(event) => handleChange("code", event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                required
              />
              {formErrors.code && <span className="text-xs text-rose-600">{formErrors.code}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Название</span>
              <input
                type="text"
                value={formValues.label}
                onChange={(event) => handleChange("label", event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                required
              />
              {formErrors.label && <span className="text-xs text-rose-600">{formErrors.label}</span>}
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Описание</span>
              <textarea
                value={formValues.description}
                onChange={(event) => handleChange("description", event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(event) => handleChange("isActive", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Справочник активен
            </label>
          </div>
          {requestError && <p className="text-sm text-rose-600">{requestError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!canManageDictionaries || isMutating}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingEntryId ? "Сохранить запись" : "Добавить запись"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:text-slate-200"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {feedback && <p className="text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p>}

      {dictionariesQuery.isLoading ? (
        <div role="status" className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Загрузка справочников…
        </div>
      ) : dictionariesQuery.isError ? (
        <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          <p>Не удалось загрузить справочники: {(dictionariesQuery.error as Error)?.message ?? "ошибка"}</p>
          <button
            type="button"
            onClick={() => dictionariesQuery.refetch()}
            className="rounded-full border border-rose-400 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-500 hover:text-rose-800 dark:border-rose-600 dark:text-rose-200"
          >
            Повторить
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Справочники не найдены. Измените фильтр или создайте новую запись.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Категория
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Код
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Название
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Описание
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Статус
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Обновлено
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Автор
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {entries.map((entry) => (
                <tr key={entry.id} className="bg-white transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {dictionaryKindOptions.find((option) => option.value === entry.kind)?.label ?? entry.kind}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.label}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{entry.description ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(entry)}
                      disabled={!canManageDictionaries || isMutating}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        entry.isActive
                          ? "border border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:text-emerald-800 dark:border-emerald-600 dark:text-emerald-300"
                          : "border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {entry.isActive ? "Активен" : "Выключен"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString("ru-RU") : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{entry.updatedBy}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(entry)}
                        disabled={!canManageDictionaries || isMutating}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        disabled={!canManageDictionaries || isMutating}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-600"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

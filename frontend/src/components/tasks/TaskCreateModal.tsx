"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/payments/Modal";
import { useCreateTask } from "@/lib/api/hooks";
import type { Client, Deal, Task, TaskActivityType, TaskStatus } from "@/types/crm";

const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting", label: "Ожидает клиента" },
  { value: "done", label: "Готово" },
  { value: "cancelled", label: "Отменена" },
];

const TASK_TYPE_OPTIONS: Array<{ value: TaskActivityType; label: string }> = [
  { value: "call", label: "Звонок" },
  { value: "meeting", label: "Встреча" },
  { value: "document", label: "Документы" },
  { value: "reminder", label: "Напоминание" },
  { value: "follow_up", label: "Фоллоу-ап" },
  { value: "other", label: "Другое" },
];

type TaskTemplateId = "policy" | "follow_up" | "renewal" | "custom";

interface TemplateContext {
  defaultOwner?: string;
  defaultDealId?: string;
  defaultClientId?: string;
}

interface TaskPreset {
  title?: string;
  owner?: string;
  status?: TaskStatus;
  type?: TaskActivityType;
  tags?: string[];
  dueDate?: Date;
  reminderAt?: Date | null;
  dealId?: string;
  clientId?: string;
}

interface TaskTemplateConfig {
  id: TaskTemplateId;
  label: string;
  description: string;
  createPreset: (context: TemplateContext) => TaskPreset;
}

interface TaskFormState {
  title: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
  type: TaskActivityType;
  tagsInput: string;
  dealId: string;
  clientId: string;
  reminderAt: string;
}

interface FormErrors {
  title?: string;
  owner?: string;
  dueDate?: string;
  reminderAt?: string;
}

const TASK_TEMPLATES: TaskTemplateConfig[] = [
  {
    id: "policy",
    label: "Оформить полис",
    description:
      "Используйте, когда клиент подтвердил условия — задача запрашивает документы и контроль оплаты.",
    createPreset: ({ defaultOwner, defaultDealId, defaultClientId }) => {
      const dueDate = getNextWorkingDay(new Date());
      dueDate.setHours(18, 0, 0, 0);
      const reminderAt = new Date(dueDate);
      reminderAt.setHours(10, 0, 0, 0);
      reminderAt.setDate(reminderAt.getDate() - 1);

      return {
        title: "Оформить выбранный полис",
        owner: defaultOwner,
        status: "in_progress",
        type: "document",
        tags: ["оформление", "полис"],
        dueDate,
        reminderAt,
        dealId: defaultDealId,
        clientId: defaultClientId,
      };
    },
  },
  {
    id: "follow_up",
    label: "Связаться с клиентом",
    description: "Напоминание уточнить решение клиента после отправленного расчёта.",
    createPreset: ({ defaultOwner, defaultDealId, defaultClientId }) => {
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 4, 0, 0, 0);
      const reminderAt = new Date();
      reminderAt.setMinutes(0, 0, 0);

      return {
        title: "Связаться с клиентом по расчёту",
        owner: defaultOwner,
        status: "waiting",
        type: "follow_up",
        tags: ["фоллоу-ап"],
        dueDate,
        reminderAt,
        dealId: defaultDealId,
        clientId: defaultClientId,
      };
    },
  },
  {
    id: "renewal",
    label: "Подготовить продление",
    description: "Создаёт задачу за две недели до окончания текущего полиса.",
    createPreset: ({ defaultOwner, defaultDealId, defaultClientId }) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      dueDate.setHours(12, 0, 0, 0);
      const reminderAt = new Date(dueDate);
      reminderAt.setDate(dueDate.getDate() - 2);
      reminderAt.setHours(9, 0, 0, 0);

      return {
        title: "Подготовить продление полиса",
        owner: defaultOwner,
        status: "new",
        type: "reminder",
        tags: ["продление"],
        dueDate,
        reminderAt,
        dealId: defaultDealId,
        clientId: defaultClientId,
      };
    },
  },
  {
    id: "custom",
    label: "Пользовательский сценарий",
    description: "Чистая форма без предзаполнения для нестандартной задачи.",
    createPreset: ({ defaultOwner, defaultDealId, defaultClientId }) => ({
      title: "",
      owner: defaultOwner,
      status: "new",
      type: "other",
      tags: [],
      dueDate: getDefaultDueDate(),
      reminderAt: null,
      dealId: defaultDealId,
      clientId: defaultClientId,
    }),
  },
];

export interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  owners: string[];
  deals: Deal[];
  clients: Client[];
  defaultOwner?: string;
  defaultDealId?: string;
  defaultClientId?: string;
  onTaskCreated?: (task: Task) => void;
}

export function TaskCreateModal({
  isOpen,
  onClose,
  owners,
  deals,
  clients,
  defaultOwner,
  defaultDealId,
  defaultClientId,
  onTaskCreated,
}: TaskCreateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplateId>("policy");
  const [formState, setFormState] = useState<TaskFormState>(() =>
    buildFormState(TASK_TEMPLATES[0].createPreset({ defaultOwner, defaultDealId, defaultClientId }))
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { mutateAsync: createTask, isPending } = useCreateTask();
  const formId = useId();
  const titleId = useId();
  const dueDateId = useId();
  const statusId = useId();
  const typeId = useId();
  const tagsId = useId();
  const dealIdField = useId();
  const clientIdField = useId();
  const reminderId = useId();
  const ownerDatalistId = useId();
  const previousDealIdRef = useRef<string | undefined>(undefined);

  const templateContext = useMemo<TemplateContext>(
    () => ({ defaultOwner, defaultDealId, defaultClientId }),
    [defaultOwner, defaultDealId, defaultClientId],
  );

  const ownerSuggestions = useMemo(
    () => Array.from(new Set([...owners, defaultOwner ?? ""].filter(Boolean))).sort((a, b) => a.localeCompare(b, "ru")),
    [owners, defaultOwner],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedTemplate("policy");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const template = TASK_TEMPLATES.find((item) => item.id === selectedTemplate) ?? TASK_TEMPLATES[0];
    const preset = template.createPreset(templateContext);
    setFormState(buildFormState(preset));
    setErrors({});
    setSubmitError(null);
    previousDealIdRef.current = preset.dealId;
  }, [isOpen, selectedTemplate, templateContext]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const currentDealId = formState.dealId || undefined;
    const previousDealId = previousDealIdRef.current;
    if (currentDealId && currentDealId !== previousDealId) {
      const deal = deals.find((item) => item.id === currentDealId);
      if (deal?.clientId) {
        setFormState((prev) => {
          if (prev.clientId === deal.clientId) {
            return prev;
          }
          return { ...prev, clientId: deal.clientId ?? "" };
        });
      }
    }
    previousDealIdRef.current = currentDealId;
  }, [isOpen, formState.dealId, deals]);

  const handleTemplateChange = (templateId: TaskTemplateId) => {
    setSelectedTemplate(templateId);
  };

  const handleChange = <Key extends keyof TaskFormState>(key: Key, value: TaskFormState[Key]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const validation = validateForm(formState);
    setErrors(validation);

    if (Object.keys(validation).length > 0) {
      return;
    }

    try {
      const dueDate = parseDateTimeLocal(formState.dueDate);
      const reminderAt = formState.reminderAt ? parseDateTimeLocal(formState.reminderAt) : null;
      if (!dueDate) {
        throw new Error("Некорректный срок задачи");
      }

      const task = await createTask({
        title: formState.title.trim(),
        owner: formState.owner.trim(),
        dueDate: dueDate.toISOString(),
        status: formState.status,
        type: formState.type,
        tags: parseTags(formState.tagsInput),
        dealId: formState.dealId ? formState.dealId : undefined,
        clientId: formState.clientId ? formState.clientId : undefined,
        reminderAt: reminderAt ? reminderAt.toISOString() : undefined,
      });

      onTaskCreated?.(task);
      onClose();
    } catch (error) {
      console.error("Не удалось создать задачу", error);
      setSubmitError(error instanceof Error ? error.message : "Не удалось создать задачу");
    }
  };

  const footer = (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={onClose}
        disabled={isPending}
      >
        Отмена
      </button>
      <button
        type="submit"
        form={formId}
        className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:bg-sky-400"
        disabled={isPending}
      >
        {isPending ? "Сохранение…" : "Сохранить задачу"}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Создание задачи"
      description="Выберите подходящий шаблон и заполните обязательные поля."
      footer={footer}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-slate-900 dark:text-slate-100">Шаблон</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {TASK_TEMPLATES.map((template) => {
              const isSelected = template.id === selectedTemplate;
              return (
                <label
                  key={template.id}
                  className={`relative flex cursor-pointer flex-col rounded-lg border p-4 transition focus-within:ring-2 focus-within:ring-sky-500 ${
                    isSelected
                      ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-900/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="task-template"
                    value={template.id}
                    checked={isSelected}
                    onChange={() => handleTemplateChange(template.id)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {template.label}
                  </span>
                  <span className="mt-1 text-xs text-slate-500 dark:text-slate-300">{template.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor={titleId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Название задачи
            </label>
            <input
              id={titleId}
              type="text"
              value={formState.title}
              onChange={(event) => handleChange("title", event.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
                errors.title ? "border-rose-400 focus-visible:outline-rose-500" : "border-slate-300"
              }`}
              placeholder="Например, подготовить документы"
              required
            />
            {errors.title ? (
              <p className="mt-1 text-xs text-rose-600" role="alert">
                {errors.title}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={dueDateId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Срок
            </label>
            <input
              id={dueDateId}
              type="datetime-local"
              value={formState.dueDate}
              onChange={(event) => handleChange("dueDate", event.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
                errors.dueDate ? "border-rose-400 focus-visible:outline-rose-500" : "border-slate-300"
              }`}
              required
            />
            {errors.dueDate ? (
              <p className="mt-1 text-xs text-rose-600" role="alert">
                {errors.dueDate}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={reminderId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Напоминание
            </label>
            <input
              id={reminderId}
              type="datetime-local"
              value={formState.reminderAt}
              onChange={(event) => handleChange("reminderAt", event.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
                errors.reminderAt ? "border-rose-400 focus-visible:outline-rose-500" : "border-slate-300"
              }`}
            />
            {errors.reminderAt ? (
              <p className="mt-1 text-xs text-rose-600" role="alert">
                {errors.reminderAt}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Необязательно, используется для push-напоминаний.</p>
            )}
          </div>

          <div>
            <label htmlFor={statusId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Статус
            </label>
            <select
              id={statusId}
              value={formState.status}
              onChange={(event) => handleChange("status", event.target.value as TaskStatus)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {TASK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={typeId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Тип активности
            </label>
            <select
              id={typeId}
              value={formState.type}
              onChange={(event) => handleChange("type", event.target.value as TaskActivityType)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={tagsId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Теги
            </label>
            <input
              id={tagsId}
              type="text"
              value={formState.tagsInput}
              onChange={(event) => handleChange("tagsInput", event.target.value)}
              placeholder="Через запятую, например: документы, приоритет"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor={dealIdField} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Сделка
            </label>
            <select
              id={dealIdField}
              value={formState.dealId}
              onChange={(event) => handleChange("dealId", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Без привязки</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={clientIdField} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Клиент
            </label>
            <select
              id={clientIdField}
              value={formState.clientId}
              onChange={(event) => handleChange("clientId", event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Без привязки</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor={ownerDatalistId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Исполнитель
            </label>
            <input
              id={ownerDatalistId}
              list={`${ownerDatalistId}-list`}
              value={formState.owner}
              onChange={(event) => handleChange("owner", event.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
                errors.owner ? "border-rose-400 focus-visible:outline-rose-500" : "border-slate-300"
              }`}
              placeholder="Укажите исполнителя"
              required
            />
            <datalist id={`${ownerDatalistId}-list`}>
              {ownerSuggestions.map((owner) => (
                <option key={owner} value={owner} />
              ))}
            </datalist>
            {errors.owner ? (
              <p className="mt-1 text-xs text-rose-600" role="alert">
                {errors.owner}
              </p>
            ) : null}
          </div>
        </div>

        {submitError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {submitError}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function buildFormState(preset: TaskPreset): TaskFormState {
  const dueDate = preset.dueDate ?? getDefaultDueDate();
  return {
    title: preset.title ?? "",
    owner: preset.owner ?? "",
    dueDate: formatDateTimeLocal(dueDate),
    status: preset.status ?? "new",
    type: preset.type ?? "other",
    tagsInput: (preset.tags ?? []).join(", "),
    dealId: preset.dealId ?? "",
    clientId: preset.clientId ?? "",
    reminderAt: preset.reminderAt ? formatDateTimeLocal(preset.reminderAt) : "",
  };
}

function validateForm(state: TaskFormState): FormErrors {
  const errors: FormErrors = {};

  if (!state.title.trim()) {
    errors.title = "Название обязательно";
  }

  if (!state.owner.trim()) {
    errors.owner = "Укажите исполнителя";
  }

  const dueDate = parseDateTimeLocal(state.dueDate);
  if (!dueDate) {
    errors.dueDate = "Некорректный формат даты";
  } else if (dueDate.getTime() <= Date.now()) {
    errors.dueDate = "Дата не может быть в прошлом";
  }

  if (state.reminderAt) {
    const reminderAt = parseDateTimeLocal(state.reminderAt);
    if (!reminderAt) {
      errors.reminderAt = "Некорректный формат напоминания";
    } else if (reminderAt.getTime() <= Date.now()) {
      errors.reminderAt = "Время напоминания не может быть в прошлом";
    } else if (dueDate && reminderAt.getTime() > dueDate.getTime()) {
      errors.reminderAt = "Напоминание должно быть раньше срока";
    }
  }

  return errors;
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDateTimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseTags(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  return value
    .split(/[,#]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getDefaultDueDate(): Date {
  const date = new Date();
  date.setHours(date.getHours() + 24, 0, 0, 0);
  return date;
}

function getNextWorkingDay(start: Date): Date {
  const date = new Date(start);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

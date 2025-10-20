"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";

import { Modal } from "@/components/payments/Modal";
import { useCreateDeal } from "@/lib/api/hooks";
import { createRandomId } from "@/lib/utils/id";
import { getManagerLabel, NO_MANAGER_VALUE } from "@/lib/utils/managers";
import type { Client, Deal } from "@/types/crm";

interface DealCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  owners: string[];
  defaultOwnerId?: string;
  onDealCreated?: (deal: Deal) => void;
}

interface FormState {
  name: string;
  clientId: string;
  nextReviewAt: string;
  ownerId: string;
  description: string;
}

interface FormErrors {
  name?: string;
  clientId?: string;
  nextReviewAt?: string;
}

function formatDateTimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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

function getDefaultNextReviewAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return formatDateTimeLocal(date);
}

function createInitialState(defaultOwnerId?: string): FormState {
  const normalizedOwner = defaultOwnerId === NO_MANAGER_VALUE ? "" : defaultOwnerId ?? "";
  return {
    name: "",
    clientId: "",
    nextReviewAt: getDefaultNextReviewAt(),
    ownerId: normalizedOwner,
    description: "",
  } satisfies FormState;
}

export function DealCreateModal({
  isOpen,
  onClose,
  clients,
  owners,
  defaultOwnerId,
  onDealCreated,
}: DealCreateModalProps) {
  const [formState, setFormState] = useState<FormState>(() => createInitialState(defaultOwnerId));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const { mutateAsync: createDeal, isPending } = useCreateDeal();
  const nameId = useId();
  const clientIdField = useId();
  const nextReviewId = useId();
  const ownerIdField = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormState(createInitialState(defaultOwnerId));
    setErrors({});
    setSubmitError(null);
    setClientSearch("");
  }, [defaultOwnerId, isOpen]);

  const orderedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = clientSearch.trim().toLowerCase();
    const prefixFiltered = normalizedSearch
      ? orderedClients.filter((client) =>
          client.name.toLowerCase().startsWith(normalizedSearch),
        )
      : orderedClients;

    if (!formState.clientId) {
      return prefixFiltered;
    }

    const selectedInFiltered = prefixFiltered.some(
      (client) => client.id === formState.clientId,
    );
    if (selectedInFiltered) {
      return prefixFiltered;
    }

    const selectedClient = orderedClients.find(
      (client) => client.id === formState.clientId,
    );
    if (!selectedClient) {
      return prefixFiltered;
    }

    return [selectedClient, ...prefixFiltered];
  }, [clientSearch, formState.clientId, orderedClients]);

  const ownerOptions = useMemo(() => {
    const unique = owners.filter((owner) => owner !== NO_MANAGER_VALUE);
    const deduplicated = Array.from(new Set(unique));
    deduplicated.sort((a, b) => getManagerLabel(a).localeCompare(getManagerLabel(b)));
    return deduplicated;
  }, [owners]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = formState.name.trim();
    const errorsAccumulator: FormErrors = {};

    if (!trimmedName) {
      errorsAccumulator.name = "Укажите название сделки";
    }

    if (!formState.clientId) {
      errorsAccumulator.clientId = "Выберите клиента";
    }

    const nextReviewDate = parseDateTimeLocal(formState.nextReviewAt);
    if (!nextReviewDate) {
      errorsAccumulator.nextReviewAt = "Укажите корректную дату";
    }

    if (Object.keys(errorsAccumulator).length > 0 || !nextReviewDate) {
      setErrors(errorsAccumulator);
      return;
    }

    setErrors({});
    setSubmitError(null);

    const selectedClient = orderedClients.find((client) => client.id === formState.clientId);
    const ownerId = formState.ownerId && formState.ownerId !== NO_MANAGER_VALUE ? formState.ownerId : "";
    const optimisticId = `deal-temp-${createRandomId()}`;
    const optimisticDeal: Deal = {
      id: optimisticId,
      name: trimmedName,
      clientId: formState.clientId,
      clientName: selectedClient?.name ?? formState.clientId,
      probability: 0,
      stage: "qualification",
      owner: ownerId || NO_MANAGER_VALUE,
      updatedAt: new Date().toISOString(),
      nextReviewAt: nextReviewDate.toISOString(),
      expectedCloseDate: undefined,
      tasks: [],
      notes: [],
      documents: [],
      payments: [],
      activity: [],
    };

    try {
      const createdDeal = await createDeal({
        payload: {
          name: trimmedName,
          clientId: formState.clientId,
          nextReviewAt: nextReviewDate.toISOString(),
          ownerId: ownerId || undefined,
          description: formState.description.trim() || undefined,
        },
        optimisticDealId: optimisticId,
        optimisticUpdater: (current) => [optimisticDeal, ...(current ?? [])],
        invalidateClientId: formState.clientId,
      });

      setFormState(createInitialState(defaultOwnerId));
      onDealCreated?.(createdDeal);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось создать сделку");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Новая сделка"
      description="Заполните обязательные поля, чтобы добавить сделку в воронку"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            disabled={isPending}
          >
            Отмена
          </button>
          <button
            type="submit"
            form="deal-create-form"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          >
            Создать
          </button>
        </>
      }
    >
      <form id="deal-create-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor={nameId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Название сделки
          </label>
          <input
            id={nameId}
            type="text"
            value={formState.name}
            onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Например, «Продление ДМС для ООО»"
          />
          {errors.name ? <p className="text-xs text-rose-500">{errors.name}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor={clientIdField} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Клиент
          </label>
          <input
            type="search"
            value={clientSearch}
            onChange={(event) => setClientSearch(event.target.value)}
            placeholder="Начните вводить имя клиента"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <select
            id={clientIdField}
            value={formState.clientId}
            onChange={(event) => setFormState((state) => ({ ...state, clientId: event.target.value }))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="" disabled>
              Выберите клиента
            </option>
            {filteredClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {errors.clientId ? <p className="text-xs text-rose-500">{errors.clientId}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor={nextReviewId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Следующий просмотр
          </label>
          <input
            id={nextReviewId}
            type="datetime-local"
            value={formState.nextReviewAt}
            onChange={(event) => setFormState((state) => ({ ...state, nextReviewAt: event.target.value }))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {errors.nextReviewAt ? <p className="text-xs text-rose-500">{errors.nextReviewAt}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor={ownerIdField} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Ответственный (опционально)
          </label>
          <select
            id={ownerIdField}
            value={formState.ownerId}
            onChange={(event) => setFormState((state) => ({ ...state, ownerId: event.target.value }))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Без ответственного</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {getManagerLabel(owner)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor={descriptionId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Описание (опционально)
          </label>
          <textarea
            id={descriptionId}
            value={formState.description}
            onChange={(event) => setFormState((state) => ({ ...state, description: event.target.value }))}
            rows={4}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Кратко опишите контекст сделки"
          />
        </div>

        {submitError ? <p className="text-xs text-rose-500">{submitError}</p> : null}
      </form>
    </Modal>
  );
}


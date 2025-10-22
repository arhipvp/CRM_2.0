"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";

import { Modal } from "@/components/payments/Modal";
import { useCreateClient } from "@/lib/api/hooks";
import { getManagerLabel, NO_MANAGER_VALUE } from "@/lib/utils/managers";
import type { Client } from "@/types/crm";

interface ClientCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  owners: string[];
  defaultOwnerId?: string;
  onClientCreated?: (client: Client) => void;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  ownerId: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

function createInitialState(defaultOwnerId?: string): FormState {
  const normalizedOwner = defaultOwnerId && defaultOwnerId !== NO_MANAGER_VALUE ? defaultOwnerId : "";

  return {
    name: "",
    email: "",
    phone: "",
    ownerId: normalizedOwner,
  } satisfies FormState;
}

function isValidEmail(value: string) {
  if (!value) {
    return false;
  }

  const candidate = value.trim();
  if (!candidate) {
    return false;
  }

  return /.+@.+\..+/i.test(candidate);
}

export function ClientCreateModal({
  isOpen,
  onClose,
  owners,
  defaultOwnerId,
  onClientCreated,
}: ClientCreateModalProps) {
  const [formState, setFormState] = useState<FormState>(() => createInitialState(defaultOwnerId));
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutateAsync: createClient, isPending } = useCreateClient();

  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const ownerIdField = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormState(createInitialState(defaultOwnerId));
    setErrors({});
    setSubmitError(null);
  }, [defaultOwnerId, isOpen]);

  const ownerOptions = useMemo(() => {
    const unique = owners.filter((owner) => owner !== NO_MANAGER_VALUE);
    const deduplicated = Array.from(new Set(unique));
    deduplicated.sort((a, b) => getManagerLabel(a).localeCompare(getManagerLabel(b)));
    return deduplicated;
  }, [owners]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = formState.name.trim();
    const trimmedEmail = formState.email.trim();
    const trimmedPhone = formState.phone.trim();

    const errorsAccumulator: FormErrors = {};

    if (!trimmedName) {
      errorsAccumulator.name = "Укажите имя клиента";
    }

    if (!isValidEmail(trimmedEmail)) {
      errorsAccumulator.email = "Укажите корректный email";
    }

    if (!trimmedPhone) {
      errorsAccumulator.phone = "Укажите телефон";
    }

    if (Object.keys(errorsAccumulator).length > 0) {
      setErrors(errorsAccumulator);
      return;
    }

    setErrors({});
    setSubmitError(null);

    const ownerId = formState.ownerId && formState.ownerId !== NO_MANAGER_VALUE ? formState.ownerId : undefined;

    try {
      const client = await createClient({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        ownerId,
      });

      setFormState(createInitialState(defaultOwnerId));
      onClientCreated?.(client);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось создать клиента");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Новый клиент"
      description="Заполните контакты, чтобы добавить клиента в CRM и продолжить создание сделки"
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
            form="client-create-form"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          >
            Создать клиента
          </button>
        </>
      }
    >
      <form id="client-create-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label htmlFor={nameId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Имя клиента
          </label>
          <input
            id={nameId}
            type="text"
            value={formState.name}
            onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Например, «ООО Норд Инжиниринг»"
          />
          {errors.name ? <p className="text-xs text-rose-500">{errors.name}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor={emailId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            value={formState.email}
            onChange={(event) => setFormState((state) => ({ ...state, email: event.target.value }))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="client@example.com"
          />
          {errors.email ? <p className="text-xs text-rose-500">{errors.email}</p> : null}
        </div>

        <div className="space-y-1">
          <label htmlFor={phoneId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Телефон
          </label>
          <input
            id={phoneId}
            type="tel"
            value={formState.phone}
            onChange={(event) => setFormState((state) => ({ ...state, phone: event.target.value }))}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Например, +7 900 123-45-67"
          />
          {errors.phone ? <p className="text-xs text-rose-500">{errors.phone}</p> : null}
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

        {submitError ? <p className="text-xs text-rose-500">{submitError}</p> : null}
      </form>
    </Modal>
  );
}

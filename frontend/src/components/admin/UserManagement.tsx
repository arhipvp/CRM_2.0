"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  useAdminRoles,
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from "@/lib/api/admin/hooks";
import { createCsv, createJson, triggerDownload } from "@/lib/utils/export";
import {
  mapUserFilters,
  useAdminFiltersStore,
} from "@/stores/adminFiltersStore";
import { useHasAdminPermission } from "@/stores/adminAccessStore";
import type { AdminUser, AdminUserStatus } from "@/types/admin";

interface UserFormState {
  fullName: string;
  email: string;
  roleId: string;
  status: AdminUserStatus;
  mfaEnabled: boolean;
}

const userStatusOptions: Array<{ value: AdminUserStatus; label: string }> = [
  { value: "active", label: "Активен" },
  { value: "invited", label: "Приглашён" },
  { value: "suspended", label: "Заблокирован" },
];

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function validateForm(values: UserFormState) {
  const errors: Partial<Record<keyof UserFormState, string>> = {};

  if (!values.fullName.trim()) {
    errors.fullName = "Укажите ФИО пользователя";
  }

  if (!values.email.trim()) {
    errors.email = "Укажите email";
  } else if (!emailPattern.test(values.email.trim().toLowerCase())) {
    errors.email = "Введите корректный email";
  }

  if (!values.roleId) {
    errors.roleId = "Выберите роль";
  }

  return errors;
}

export function UserManagement() {
  const canManageUsers = useHasAdminPermission("manage:users");
  const userFilters = useAdminFiltersStore((state) => state.userFilters);
  const setUserSearch = useAdminFiltersStore((state) => state.setUserSearch);
  const toggleUserRole = useAdminFiltersStore((state) => state.toggleUserRole);
  const setUserStatuses = useAdminFiltersStore((state) => state.setUserStatuses);
  const clearUserFilters = useAdminFiltersStore((state) => state.clearUserFilters);

  const queryFilters = useMemo(() => mapUserFilters(userFilters), [userFilters]);

  const rolesQuery = useAdminRoles();
  const usersQuery = useAdminUsers(queryFilters);

  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const [isCreating, setIsCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<UserFormState>({
    fullName: "",
    email: "",
    roleId: "",
    status: "invited",
    mfaEnabled: false,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const users = usersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const isMutating = createUser.isPending || updateUser.isPending || deleteUser.isPending;

  const handleStartCreate = () => {
    setFeedback(null);
    setRequestError(null);
    setFormErrors({});
    setEditingUserId(null);
    setFormValues({
      fullName: "",
      email: "",
      roleId: roles[0]?.id ?? "",
      status: "invited",
      mfaEnabled: false,
    });
    setIsCreating(true);
  };

  const handleEdit = (user: AdminUser) => {
    setFeedback(null);
    setRequestError(null);
    setFormErrors({});
    setIsCreating(false);
    setEditingUserId(user.id);
    setFormValues({
      fullName: user.fullName,
      email: user.email,
      roleId: user.roleId,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
    });
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingUserId(null);
    setFormValues({
      fullName: "",
      email: "",
      roleId: roles[0]?.id ?? "",
      status: "invited",
      mfaEnabled: false,
    });
    setFormErrors({});
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleChange = (field: keyof UserFormState, value: string | boolean) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: typeof value === "string" ? value : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setRequestError(null);
    const errors = validateForm(formValues);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      if (editingUserId) {
        await updateUser.mutateAsync({ userId: editingUserId, payload: formValues });
        setFeedback("Пользователь обновлён");
      } else {
        await createUser.mutateAsync(formValues);
        setFeedback("Пользователь создан и приглашён");
      }
      resetForm();
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError(error.message);
      } else if (error instanceof Error) {
        setRequestError(error.message);
      } else {
        setRequestError("Не удалось сохранить пользователя");
      }
    }
  };

  const handleDelete = async (user: AdminUser) => {
    setFeedback(null);
    setRequestError(null);
    if (!window.confirm(`Удалить пользователя ${user.fullName}?`)) {
      return;
    }

    try {
      await deleteUser.mutateAsync({ userId: user.id });
      setFeedback("Пользователь удалён");
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError(error.message);
      } else if (error instanceof Error) {
        setRequestError(error.message);
      } else {
        setRequestError("Не удалось удалить пользователя");
      }
    }
  };

  const handleExport = (format: "csv" | "json") => {
    if (users.length === 0) {
      return;
    }

    const fileStamp = new Date().toISOString().split("T")[0];
    if (format === "json") {
      const content = createJson(
        users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.roleName,
          status: user.status,
          mfaEnabled: user.mfaEnabled,
          lastActiveAt: user.lastActiveAt,
        })),
      );
      triggerDownload({
        fileName: `admin-users-${fileStamp}.json`,
        content,
        mimeType: "application/json",
      });
      return;
    }

    const headers = ["ФИО", "Email", "Роль", "Статус", "MFA", "Последняя активность"];
    const rows = users.map((user) => [
      user.fullName,
      user.email,
      user.roleName,
      user.status,
      user.mfaEnabled ? "Да" : "Нет",
      user.lastActiveAt ? formatDate(user.lastActiveAt) : "—",
    ]);
    const content = createCsv(headers, rows);
    triggerDownload({
      fileName: `admin-users-${fileStamp}.csv`,
      content,
      mimeType: "text/csv",
    });
  };

  return (
    <section aria-labelledby="admin-user-management" className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="admin-user-management" className="text-xl font-semibold text-slate-900 dark:text-white">
              Управление пользователями
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Создавайте аккаунты, назначайте роли и отслеживайте актуальность MFA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              onClick={() => handleExport("json")}
              disabled={users.length === 0}
            >
              Экспорт JSON
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              onClick={() => handleExport("csv")}
              disabled={users.length === 0}
            >
              Экспорт CSV
            </button>
            <button
              type="button"
              onClick={handleStartCreate}
              disabled={!canManageUsers || isMutating}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Новый пользователь
            </button>
          </div>
        </div>
        {!canManageUsers && (
          <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
            У вас нет прав на редактирование пользователей. Доступ доступен только главному админу.
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Поиск</span>
          <input
            type="search"
            value={userFilters.search}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Имя или email"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <fieldset className="flex flex-col gap-2" aria-label="Роли">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Роли</span>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={userFilters.roleIds.includes(role.id)}
                  onChange={() => toggleUserRole(role.id)}
                />
                {role.name}
              </label>
            ))}
            {roles.length === 0 && <span className="text-xs text-slate-400">Нет данных о ролях</span>}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2" aria-label="Статусы">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Статусы</span>
          <div className="flex flex-wrap gap-2">
            {userStatusOptions.map((status) => (
              <label key={status.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={userFilters.statuses.includes(status.value)}
                  onChange={() => {
                    const hasStatus = userFilters.statuses.includes(status.value);
                    if (hasStatus) {
                      setUserStatuses(userFilters.statuses.filter((item) => item !== status.value));
                    } else {
                      setUserStatuses([...userFilters.statuses, status.value]);
                    }
                  }}
                />
                {status.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm font-medium text-sky-600 hover:underline disabled:opacity-50"
          onClick={clearUserFilters}
          disabled={
            userFilters.search.length === 0 &&
            userFilters.roleIds.length === 0 &&
            userFilters.statuses.length === 0
          }
        >
          Сбросить фильтры
        </button>
        {(usersQuery.isFetching || rolesQuery.isFetching) && (
          <span role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
            Обновляем данные…
          </span>
        )}
      </div>

      {(isCreating || editingUserId) && (
        <form
          noValidate
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
        >
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {editingUserId ? "Редактирование пользователя" : "Новый пользователь"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">ФИО</span>
              <input
                type="text"
                value={formValues.fullName}
                onChange={(event) => handleChange("fullName", event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                required
              />
              {formErrors.fullName && <span className="text-xs text-rose-600">{formErrors.fullName}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Email</span>
              <input
                type="email"
                value={formValues.email}
                onChange={(event) => handleChange("email", event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                required
              />
              {formErrors.email && <span className="text-xs text-rose-600">{formErrors.email}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Роль</span>
              <select
                value={formValues.roleId}
                onChange={(event) => handleChange("roleId", event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Выберите роль</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {formErrors.roleId && <span className="text-xs text-rose-600">{formErrors.roleId}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Статус</span>
              <select
                value={formValues.status}
                onChange={(event) => handleChange("status", event.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {userStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={formValues.mfaEnabled}
                onChange={(event) => handleChange("mfaEnabled", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Многофакторная аутентификация включена
            </label>
          </div>
          {requestError && <p className="text-sm text-rose-600">{requestError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!canManageUsers || isMutating}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingUserId ? "Сохранить изменения" : "Создать пользователя"}
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

      {usersQuery.isLoading ? (
        <div role="status" className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Загрузка пользователей…
        </div>
      ) : usersQuery.isError ? (
        <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          <p>Не удалось загрузить пользователей: {(usersQuery.error as Error)?.message ?? "ошибка"}</p>
          <button
            type="button"
            onClick={() => usersQuery.refetch()}
            className="rounded-full border border-rose-400 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-500 hover:text-rose-800 dark:border-rose-600 dark:text-rose-200"
          >
            Повторить
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Пользователи не найдены. Измените фильтры или создайте нового пользователя.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Пользователь
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Email
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Роль
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Статус
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  MFA
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Активность
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {users.map((user) => (
                <tr key={user.id} className="bg-white transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{user.fullName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{user.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{user.roleName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{userStatusOptions.find((option) => option.value === user.status)?.label ?? user.status}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{user.mfaEnabled ? "Включена" : "Отключена"}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{user.lastActiveAt ? formatDate(user.lastActiveAt) : "Нет данных"}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(user)}
                        disabled={!canManageUsers || isMutating}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        disabled={!canManageUsers || isMutating}
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

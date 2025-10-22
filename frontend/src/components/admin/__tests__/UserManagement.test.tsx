import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithQueryClient, createTestQueryClient } from "@/test-utils";
import { UserManagement } from "@/components/admin/UserManagement";
import { apiClient } from "@/lib/api/client";
import { adminRolesMock, adminUsersMock } from "@/mocks/data";
import { adminRolesQueryOptions, adminUsersQueryOptions } from "@/lib/api/admin/queries";
import { useAdminFiltersStore } from "@/stores/adminFiltersStore";

function resetFilters() {
  useAdminFiltersStore.setState((state) => ({
    ...state,
    userFilters: { search: "", roleIds: [], statuses: [] },
    dictionaryFilters: { kind: "all", search: "" },
    auditFilters: { search: "", scope: "all", severity: "all", actorIds: [], dateFrom: undefined, dateTo: undefined },
  }));
}

describe("UserManagement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetFilters();
  });

  it("отображает пользователей и валидирует создание", async () => {
    const client = createTestQueryClient();
    client.setQueryData(adminRolesQueryOptions().queryKey, adminRolesMock);
    client.setQueryData(adminUsersQueryOptions().queryKey, adminUsersMock);

    const createSpy = vi
      .spyOn(apiClient, "createAdminUser")
      .mockResolvedValue({
        ...adminUsersMock[0],
        id: "new-admin-user",
        fullName: "Тестовый Пользователь",
        email: "test@example.com",
      });

    renderWithQueryClient(<UserManagement />, client);

    expect(await screen.findByText(adminUsersMock[0].fullName)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Новый пользователь" }));

    const fullNameInput = await screen.findByLabelText("ФИО");
    const emailInput = await screen.findByLabelText("Email");
    const roleSelect = await screen.findByLabelText("Роль");
    const submitButton = screen.getByRole("button", { name: "Создать пользователя" });

    await userEvent.clear(fullNameInput);
    await userEvent.click(submitButton);

    expect(await screen.findByText(/укажите фио/i)).toBeInTheDocument();

    await userEvent.type(fullNameInput, "Тестовый Пользователь");
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, "test@example.com");
    await userEvent.selectOptions(roleSelect, adminRolesMock[0].id);

    await userEvent.click(submitButton);

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        fullName: "Тестовый Пользователь",
        email: "test@example.com",
        roleId: adminRolesMock[0].id,
        status: "invited",
        mfaEnabled: false,
      }),
    );
  });

  it("обновляет пользователя", async () => {
    const client = createTestQueryClient();
    client.setQueryData(adminRolesQueryOptions().queryKey, adminRolesMock);
    client.setQueryData(adminUsersQueryOptions().queryKey, adminUsersMock);

    const updateSpy = vi
      .spyOn(apiClient, "updateAdminUser")
      .mockResolvedValue({ ...adminUsersMock[1], status: "suspended" });

    renderWithQueryClient(<UserManagement />, client);

    await screen.findByText(adminUsersMock[1].fullName);

    const userRow = screen.getByText(adminUsersMock[1].fullName).closest("tr");
    expect(userRow).toBeTruthy();
    const editButton = within(userRow as HTMLTableRowElement).getByRole("button", {
      name: "Редактировать",
    });
    await userEvent.click(editButton);

    const statusSelect = await screen.findByLabelText("Статус");
    const saveButton = screen.getByRole("button", { name: "Сохранить изменения" });

    await userEvent.selectOptions(statusSelect, "suspended");
    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        adminUsersMock[1].id,
        expect.objectContaining({ status: "suspended" }),
      ),
    );
  });
});

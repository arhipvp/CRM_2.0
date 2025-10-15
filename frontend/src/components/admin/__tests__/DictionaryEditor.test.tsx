import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient, createTestQueryClient } from "@/test-utils";
import { DictionaryEditor } from "@/components/admin/DictionaryEditor";
import { apiClient } from "@/lib/api/client";
import { adminDictionariesMock } from "@/mocks/data";
import { adminDictionariesQueryOptions } from "@/lib/api/admin/queries";
import { useAdminFiltersStore } from "@/stores/adminFiltersStore";

function resetFilters() {
  useAdminFiltersStore.setState((state) => ({
    ...state,
    userFilters: { search: "", roleIds: [], statuses: [] },
    dictionaryFilters: { kind: "all", search: "" },
    auditFilters: { search: "", scope: "all", severity: "all", actorIds: [], dateFrom: undefined, dateTo: undefined },
  }));
}

describe("DictionaryEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetFilters();
  });

  it("создаёт запись со строгой валидацией", async () => {
    const client = createTestQueryClient();
    client.setQueryData(adminDictionariesQueryOptions().queryKey, adminDictionariesMock);

    const createSpy = vi
      .spyOn(apiClient, "createAdminDictionaryEntry")
      .mockResolvedValue({
        ...adminDictionariesMock[0],
        id: "dict-new",
        code: "new_code",
        label: "Новая запись",
      });

    renderWithQueryClient(<DictionaryEditor />, client);

    expect(await screen.findByText(adminDictionariesMock[0].label)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Новая запись" }));

    const codeInput = await screen.findByLabelText("Код");
    const labelInput = await screen.findByLabelText("Название");
    const submitButton = screen.getByRole("button", { name: "Добавить запись" });

    await userEvent.clear(codeInput);
    await userEvent.click(submitButton);

    expect(await screen.findByText(/укажите уникальный код/i)).toBeInTheDocument();

    await userEvent.type(codeInput, "new_code");
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, "Новая запись");
    await userEvent.click(submitButton);

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        "dealTypes",
        expect.objectContaining({ code: "new_code", label: "Новая запись" }),
      ),
    );
  });

  it("переключает статус записи", async () => {
    const client = createTestQueryClient();
    client.setQueryData(adminDictionariesQueryOptions().queryKey, adminDictionariesMock);

    const toggleSpy = vi
      .spyOn(apiClient, "updateAdminDictionaryEntry")
      .mockResolvedValue({ ...adminDictionariesMock[0], isActive: !adminDictionariesMock[0].isActive });

    renderWithQueryClient(<DictionaryEditor />, client);

    await screen.findByText(adminDictionariesMock[0].label);

    const statusToggle = screen.getAllByRole("button", { name: /Активен|Выключен/ })[0];
    await userEvent.click(statusToggle);

    await waitFor(() =>
      expect(toggleSpy).toHaveBeenCalledWith(
        adminDictionariesMock[0].id,
        { isActive: !adminDictionariesMock[0].isActive },
      ),
    );
  });
});

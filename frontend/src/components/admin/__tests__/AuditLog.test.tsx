import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient, createTestQueryClient } from "@/test-utils";
import { AuditLog } from "@/components/admin/AuditLog";
import { apiClient } from "@/lib/api/client";
import { adminAuditLogMock } from "@/mocks/data";
import { adminAuditLogQueryOptions } from "@/lib/api/admin/queries";
import { useAdminFiltersStore } from "@/stores/adminFiltersStore";
import { triggerDownload } from "@/lib/utils/export";

vi.mock("@/lib/utils/export", () => ({
  triggerDownload: vi.fn(),
}));

const triggerDownloadMock = triggerDownload as unknown as ReturnType<typeof vi.fn>;

function resetFilters() {
  useAdminFiltersStore.setState((state) => ({
    ...state,
    userFilters: { search: "", roleIds: [], statuses: [] },
    dictionaryFilters: { kind: "all", search: "" },
    auditFilters: { search: "", scope: "all", severity: "all", actorIds: [], dateFrom: undefined, dateTo: undefined },
  }));
}

describe("AuditLog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetFilters();
    triggerDownloadMock.mockReset();
  });

  it("показывает аудит и подсвечивает ошибки диапазона дат", async () => {
    const client = createTestQueryClient();
    client.setQueryData(adminAuditLogQueryOptions().queryKey, adminAuditLogMock);

    renderWithQueryClient(<AuditLog />, client);

    expect(await screen.findByText(adminAuditLogMock[0].summary)).toBeInTheDocument();

    const fromInput = screen.getByLabelText("С даты");
    const toInput = screen.getByLabelText("По дату");

    await userEvent.type(fromInput, "2025-01-10");
    await userEvent.type(toInput, "2024-12-01");

    expect(await screen.findByText(/дата начала не может быть позже/i)).toBeInTheDocument();
  });

  it("выгружает журнал", async () => {
    const client = createTestQueryClient();
    client.setQueryData(adminAuditLogQueryOptions().queryKey, adminAuditLogMock);

    const exportSpy = vi
      .spyOn(apiClient, "exportAdminAuditLog")
      .mockResolvedValue({ fileName: "audit.csv", mimeType: "text/csv", content: "id,actor" });

    renderWithQueryClient(<AuditLog />, client);

    await screen.findByText(adminAuditLogMock[0].summary);

    await userEvent.click(screen.getByRole("button", { name: "Экспорт CSV" }));

    await waitFor(() => expect(exportSpy).toHaveBeenCalled());
    expect(triggerDownloadMock).toHaveBeenCalledWith({ fileName: "audit.csv", mimeType: "text/csv", content: "id,actor" });
  });
});

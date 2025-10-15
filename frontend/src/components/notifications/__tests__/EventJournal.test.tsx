import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient, createTestQueryClient } from "@/test-utils";
import { EventJournal } from "@/components/notifications/EventJournal";
import { apiClient } from "@/lib/api/client";
import { notificationJournalQueryOptions } from "@/lib/api/queries";
import { notificationEventJournalMock } from "@/mocks/data";

describe("EventJournal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("отображает skeleton во время загрузки", () => {
    const client = createTestQueryClient();
    const pending = new Promise<never>(() => {});
    vi.spyOn(apiClient, "getNotificationEventJournal").mockReturnValue(pending as never);

    renderWithQueryClient(<EventJournal />, client);

    expect(screen.getByRole("status", { name: /Загрузка журнала/i })).toBeInTheDocument();
  });

  it("рендерит пустое состояние", async () => {
    const client = createTestQueryClient();
    client.setQueryData(notificationJournalQueryOptions().queryKey, {
      items: [],
      availableCategories: [],
      availableSources: [],
    });

    const { findByText } = renderWithQueryClient(<EventJournal />, client);

    expect(await findByText(/Событий не найдено/i)).toBeInTheDocument();
  });

  it("показывает ошибку и кнопку повтора", async () => {
    const client = createTestQueryClient();
    const spy = vi.spyOn(apiClient, "getNotificationEventJournal").mockRejectedValue(new Error("fail"));

    const { findByRole } = renderWithQueryClient(<EventJournal />, client);
    const retry = await findByRole("button", { name: /Повторить загрузку/i });
    await userEvent.click(retry);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it("отображает строки журнала", async () => {
    const client = createTestQueryClient();
    client.setQueryData(notificationJournalQueryOptions().queryKey, {
      items: notificationEventJournalMock.slice(0, 2),
      availableCategories: [
        { value: "deal", label: "Сделки" },
        { value: "payment", label: "Платежи" },
      ],
      availableSources: [
        { value: "crm", label: "CRM" },
        { value: "system", label: "Система" },
      ],
    });

    const { findByText } = renderWithQueryClient(<EventJournal />, client);

    expect(await findByText(notificationEventJournalMock[0].summary)).toBeInTheDocument();
    expect(await findByText(notificationEventJournalMock[1].summary)).toBeInTheDocument();
  });
});

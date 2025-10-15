import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, within } from "@testing-library/react";

import { ClientWorkspace } from "@/components/clients/ClientWorkspace";
import {
  activitiesMock,
  clientPoliciesMock,
  clientRemindersMock,
  clientTaskChecklistMock,
  clientsMock,
} from "@/mocks/data";
import {
  clientActivityQueryOptions,
  clientPoliciesQueryOptions,
  clientQueryOptions,
  clientRemindersQueryOptions,
  clientTasksChecklistQueryOptions,
} from "@/lib/api/queries";
import { apiClient } from "@/lib/api/client";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";
import type { ActivityLogEntry, PaginatedResult } from "@/types/crm";

const clientId = clientsMock[0].id;

function createActivity(clientId: string): PaginatedResult<ActivityLogEntry> {
  const items = activitiesMock
    .filter((entry) => entry.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageSize = 5;
  return {
    items: items.slice(0, pageSize),
    total: items.length,
    page: 1,
    pageSize,
  };
}

function seedClientData() {
  const queryClient = createTestQueryClient();

  queryClient.setQueryData(clientQueryOptions(clientId).queryKey, clientsMock[0]);
  queryClient.setQueryData(
    clientPoliciesQueryOptions(clientId, { status: "active" }).queryKey,
    clientPoliciesMock.filter((policy) => policy.clientId === clientId && !["archived", "cancelled", "expired"].includes(policy.status)),
  );
  queryClient.setQueryData(
    clientPoliciesQueryOptions(clientId, { status: "archived" }).queryKey,
    clientPoliciesMock.filter((policy) => policy.clientId === clientId && ["archived", "cancelled", "expired"].includes(policy.status)),
  );
  queryClient.setQueryData(clientActivityQueryOptions(clientId, { page: 1, pageSize: 5 }).queryKey, createActivity(clientId));
  queryClient.setQueryData(
    clientTasksChecklistQueryOptions(clientId).queryKey,
    clientTaskChecklistMock.filter((task) => task.clientId === clientId),
  );
  queryClient.setQueryData(
    clientRemindersQueryOptions(clientId).queryKey,
    clientRemindersMock.filter((reminder) => reminder.clientId === clientId),
  );

  return queryClient;
}

describe("ClientWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("отображает профиль клиента и открывает модал редактирования", async () => {
    const queryClient = seedClientData();
    renderWithQueryClient(<ClientWorkspace clientId={clientId} />, queryClient);

    expect(await screen.findByRole("heading", { name: clientsMock[0].name })).toBeInTheDocument();
    expect(screen.getAllByText(clientsMock[0].email)[0]).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Редактировать контакты" }));
    const dialog = await screen.findByRole("dialog", { name: /Редактирование контактных данных/i });
    expect(within(dialog).getByDisplayValue(clientsMock[0].email)).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText(/E-mail/i));
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    expect(within(dialog).getByText(/Укажите e-mail/i)).toBeVisible();
  });

  it("переключает вкладки активности и фильтрует события", async () => {
    const queryClient = seedClientData();
    renderWithQueryClient(<ClientWorkspace clientId={clientId} />, queryClient);

    await userEvent.click(screen.getByRole("tab", { name: "Активность" }));
    expect(screen.queryByText(/История пока пуста/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Письма" }));
    const events = await screen.findAllByRole("article");
    expect(events.length).toBeGreaterThan(0);
    events.forEach((event) => {
      expect(within(event).getByText(/Письма|Письмо/)).toBeInTheDocument();
    });
  });

  it("отмечает задачу выполненной", async () => {
    const toggleSpy = vi.spyOn(apiClient, "toggleClientTask");
    const queryClient = seedClientData();
    renderWithQueryClient(<ClientWorkspace clientId={clientId} />, queryClient);

    await userEvent.click(screen.getByRole("tab", { name: "Задачи" }));
    const firstTaskCheckbox = await screen.findByRole("checkbox", {
      name: new RegExp(clientTaskChecklistMock.find((task) => task.clientId === clientId)?.title ?? ""),
    });

    await userEvent.click(firstTaskCheckbox);
    expect(toggleSpy).toHaveBeenCalled();
  });
});

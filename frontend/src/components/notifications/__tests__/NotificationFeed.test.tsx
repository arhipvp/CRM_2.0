import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQueryClient, createTestQueryClient } from "@/test-utils";
import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { apiClient } from "@/lib/api/client";
import { notificationsFeedQueryOptions } from "@/lib/api/queries";
import {
  notificationChannelSettingsMock,
  notificationFeedMock,
} from "@/mocks/data";
import { useNotificationsStore } from "@/stores/notificationsStore";

describe("NotificationFeed", () => {
  beforeEach(() => {
    act(() => {
      useNotificationsStore.getState().reset();
    });
    vi.restoreAllMocks();
  });

  it("показывает состояние загрузки", () => {
    const client = createTestQueryClient();
    const pending = new Promise<never>(() => {});
    vi.spyOn(apiClient, "getNotificationFeed").mockReturnValue(pending as never);

    renderWithQueryClient(<NotificationFeed />, client);

    expect(screen.getByRole("status", { name: /Загрузка уведомлений/i })).toBeInTheDocument();
  });

  it("отображает пустое состояние", async () => {
    const client = createTestQueryClient();
    client.setQueryData(notificationsFeedQueryOptions().queryKey, {
      items: [],
      unreadCount: 0,
      availableCategories: [],
      availableSources: [],
      channelSettings: notificationChannelSettingsMock,
    });

    const { findByText } = renderWithQueryClient(<NotificationFeed />, client);

    expect(await findByText(/Новых уведомлений нет/i)).toBeInTheDocument();
  });

  it("показывает ошибку и повторяет запрос", async () => {
    const client = createTestQueryClient();
    const spy = vi.spyOn(apiClient, "getNotificationFeed").mockRejectedValue(new Error("network error"));

    const { findByRole } = renderWithQueryClient(<NotificationFeed />, client);
    const retry = await findByRole("button", { name: /Повторить попытку/i });
    await userEvent.click(retry);

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it("рендерит список уведомлений", async () => {
    const client = createTestQueryClient();
    client.setQueryData(notificationsFeedQueryOptions().queryKey, {
      items: notificationFeedMock.slice(0, 2),
      unreadCount: 2,
      availableCategories: [
        { value: "deal", label: "Сделки" },
        { value: "payment", label: "Платежи" },
      ],
      availableSources: [
        { value: "crm", label: "CRM" },
        { value: "payments", label: "Платежи" },
      ],
      channelSettings: notificationChannelSettingsMock,
    });

    const { findByText } = renderWithQueryClient(<NotificationFeed />, client);

    expect(await findByText(notificationFeedMock[0].title)).toBeInTheDocument();
    expect(await findByText(notificationFeedMock[1].title)).toBeInTheDocument();
  });
});

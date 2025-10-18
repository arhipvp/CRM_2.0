import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";

import { HomeRecentDeals } from "@/components/home/HomeRecentDeals";
import * as apiHooks from "@/lib/api/hooks";
import { dealsQueryOptions } from "@/lib/api/queries";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";
import type { Deal } from "@/types/crm";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";

const filters = createDefaultDealFilters();

const mockDeal: Deal = {
  id: "home-1",
  name: "Продажа ОСАГО",
  clientId: "client-home-1",
  clientName: "ООО «Прогресс»",
  value: 120_000,
  probability: 0.5,
  stage: "negotiation",
  owner: "Сергей Сергеев",
  updatedAt: new Date("2024-03-01T09:00:00Z").toISOString(),
  nextReviewAt: new Date("2024-03-05T12:00:00Z").toISOString(),
  expectedCloseDate: new Date("2024-03-20T12:00:00Z").toISOString(),
  tasks: [],
  notes: [],
  documents: [],
  payments: [],
  activity: [],
};

afterEach(() => {
  filters.search = "";
  filters.managers = [];
  vi.restoreAllMocks();
});

describe("HomeRecentDeals", () => {
  it("показывает ближайшие сделки", () => {
    const client = createTestQueryClient();
    client.setQueryData(dealsQueryOptions(filters).queryKey, [mockDeal]);

    renderWithQueryClient(<HomeRecentDeals filters={filters} />, client);

    expect(screen.getByText("Предстоящие обзвоны и встречи")).toBeVisible();
    expect(screen.getByText("Продажа ОСАГО")).toBeVisible();
    expect(screen.getByText("ООО «Прогресс»")).toBeVisible();
    expect(screen.getByText(/Сергей Сергеев/)).toBeVisible();
  });

  it("отображает ошибку и позволяет повторить", async () => {
    vi.spyOn(apiHooks, "useDeals").mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error("Ошибка сети"),
      isFetching: false,
      refetch: vi.fn(),
    });

    renderWithQueryClient(<HomeRecentDeals filters={filters} />);

    expect(await screen.findByText("Не удалось загрузить список сделок")).toBeVisible();

    const retryButton = screen.getByRole("button", { name: "Повторить" });
    await userEvent.click(retryButton);
    expect(retryButton).toBeEnabled();
  });

  it("показывает пустое состояние", () => {
    const client = createTestQueryClient();
    client.setQueryData(dealsQueryOptions(filters).queryKey, []);

    renderWithQueryClient(<HomeRecentDeals filters={filters} />, client);

    expect(screen.getByText("Нет сделок для отображения")).toBeVisible();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act, screen, within } from "@testing-library/react";

import { DealsTable } from "@/components/deals/DealsTable";
import * as apiHooks from "@/lib/api/hooks";
import { dealsQueryOptions } from "@/lib/api/queries";
import { type Deal } from "@/types/crm";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";
import { useUiStore } from "@/stores/uiStore";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";

const initialState = useUiStore.getState();

const baseDeal: Deal = {
  id: "deal-1",
  name: "Страхование",
  clientId: "client-1",
  clientName: "ООО «Ромашка»",
  value: 150_000,
  probability: 0.6,
  stage: "qualification",
  owner: "Иван Иванов",
  updatedAt: new Date("2024-02-01T10:00:00Z").toISOString(),
  nextReviewAt: new Date("2024-02-10T10:00:00Z").toISOString(),
  expectedCloseDate: new Date("2024-02-20T10:00:00Z").toISOString(),
  tasks: [],
  notes: [],
  documents: [],
  payments: [],
  activity: [],
};

afterEach(() => {
  useUiStore.setState(initialState, true);
  vi.restoreAllMocks();
});

describe("DealsTable", () => {
  it("отображает список сделок", () => {
    const client = createTestQueryClient();
    const deals: Deal[] = [
      baseDeal,
      {
        ...baseDeal,
        id: "deal-2",
        name: "Продление",
        clientId: "client-2",
        clientName: "ИП Петров",
        value: 90_000,
        probability: 0.4,
        stage: "proposal",
        owner: "Мария Смирнова",
        updatedAt: new Date("2024-02-02T12:00:00Z").toISOString(),
        nextReviewAt: new Date("2024-02-12T09:00:00Z").toISOString(),
        expectedCloseDate: new Date("2024-02-25T09:00:00Z").toISOString(),
      },
    ];

    client.setQueryData(dealsQueryOptions(createDefaultDealFilters()).queryKey, deals);

    renderWithQueryClient(<DealsTable />, client);

    expect(screen.getByRole("table", { name: /Список сделок/i })).toBeInTheDocument();
    expect(screen.getByText("Страхование")).toBeVisible();
    expect(screen.getByText("Продление")).toBeVisible();
    expect(screen.getByText("ООО «Ромашка»")).toBeVisible();
    expect(screen.getByText("ИП Петров")).toBeVisible();
  });

  it("отображает ошибку и позволяет повторить загрузку", async () => {
    vi.spyOn(apiHooks, "useDeals").mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error("Запрос недоступен"),
      isFetching: false,
      refetch: vi.fn(),
    });

    renderWithQueryClient(<DealsTable />);

    expect(await screen.findByText("Не удалось загрузить сделки")).toBeVisible();

    const retryButton = screen.getByRole("button", { name: "Повторить" });
    await userEvent.click(retryButton);
    expect(retryButton).toBeEnabled();
  });

  it("открывает предпросмотр при клике по строке", async () => {
    const client = createTestQueryClient();
    const deals: Deal[] = [baseDeal];

    client.setQueryData(dealsQueryOptions(createDefaultDealFilters()).queryKey, deals);

    renderWithQueryClient(<DealsTable />, client);

    const dealCell = await screen.findByText("Страхование");
    const dealRow = dealCell.closest("tr");
    expect(dealRow).toBeTruthy();

    await act(async () => {
      await userEvent.click(dealRow as HTMLTableRowElement);
    });

    expect(useUiStore.getState().previewDealId).toBe("deal-1");
  });

  it("показывает пустое состояние и сбрасывает фильтры", async () => {
    const client = createTestQueryClient();
    const filters = createDefaultDealFilters();
    filters.search = "test";
    useUiStore.setState({ filters });

    client.setQueryData(dealsQueryOptions(filters).queryKey, []);

    renderWithQueryClient(<DealsTable />, client);

    expect(screen.getByText("Сделки не найдены для выбранных фильтров.")).toBeVisible();

    const resetButton = screen.getByRole("button", { name: "Сбросить фильтры" });
    await act(async () => {
      await userEvent.click(resetButton);
    });

    expect(useUiStore.getState().filters).toEqual(createDefaultDealFilters());
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DealFunnelHeader } from "@/components/deals/DealFunnelHeader";
import { dealStageMetricsQueryOptions, dealsQueryOptions } from "@/lib/api/queries";
import { dealsMock } from "@/mocks/data";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";
import { useUiStore } from "@/stores/uiStore";
import type { DealFilters } from "@/types/crm";

function createManagerFilters(
  filters: ReturnType<typeof useUiStore.getState>["filters"],
): DealFilters {
  return {
    stage: filters.stage,
    period: filters.period,
    search: filters.search,
    managers: [],
  };
}

describe("DealFunnelHeader", () => {
  const initialState = useUiStore.getState();

  beforeEach(() => {
    useUiStore.setState(initialState, true);
  });

  it("отображает полученные метрики стадий", async () => {
    const client = createTestQueryClient();
    const filters = useUiStore.getState().filters;
    const managerFilters = createManagerFilters(filters);

    client.setQueryData(dealsQueryOptions(managerFilters).queryKey, dealsMock);
    client.setQueryData(dealsQueryOptions(filters).queryKey, dealsMock);
    client.setQueryData(dealStageMetricsQueryOptions(filters).queryKey, [
      {
        stage: "qualification",
        count: 2,
        totalValue: 1_500_000,
        conversionRate: 1,
        avgCycleDurationDays: 2.5,
      },
      {
        stage: "negotiation",
        count: 1,
        totalValue: 210_000,
        conversionRate: 0.5,
        avgCycleDurationDays: 3,
      },
    ]);

    renderWithQueryClient(<DealFunnelHeader />, client);

    const qualificationCard = await screen.findByRole("button", { name: /Квалификация/ });
    expect(within(qualificationCard).getByText("2")).toBeInTheDocument();
    expect(within(qualificationCard).getByTitle("Конверсия")).toHaveTextContent("100%");
    expect(within(qualificationCard).getByText(/1[\s\u00a0\u202f]?500[\s\u00a0\u202f]?000/)).toBeInTheDocument();
    expect(within(qualificationCard).getByText(/Средний цикл: 2\.5 дн\./)).toBeInTheDocument();

    const negotiationCard = screen.getByRole("button", { name: /Переговоры/ });
    expect(within(negotiationCard).getByText("1")).toBeInTheDocument();
    expect(within(negotiationCard).getByTitle("Конверсия")).toHaveTextContent("50%");
  });

  it("сохраняет выбранных менеджеров доступными при последовательном выборе", async () => {
    const client = createTestQueryClient();
    const filters = useUiStore.getState().filters;
    const managerFilters = createManagerFilters(filters);

    client.setQueryData(dealsQueryOptions(managerFilters).queryKey, dealsMock);
    client.setQueryData(dealsQueryOptions(filters).queryKey, dealsMock);
    client.setQueryData(dealStageMetricsQueryOptions(filters).queryKey, []);

    const user = userEvent.setup();

    renderWithQueryClient(<DealFunnelHeader />, client);

    await user.click(screen.getByRole("button", { name: /Менеджеры/ }));

    const annaCheckbox = await screen.findByLabelText("Анна Савельева");
    const ivanCheckbox = screen.getByLabelText("Иван Плахов");

    await user.click(annaCheckbox);
    await user.click(ivanCheckbox);

    expect(annaCheckbox).toBeChecked();
    expect(ivanCheckbox).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Готово" }));

    await act(async () => {
      useUiStore.setState((state) => ({
        filters: { ...state.filters, stage: "closedLost" },
      }));
    });

    const updatedFilters = useUiStore.getState().filters;
    const updatedManagerFilters = createManagerFilters(updatedFilters);

    client.setQueryData(dealsQueryOptions(updatedManagerFilters).queryKey, []);
    client.setQueryData(dealsQueryOptions(updatedFilters).queryKey, []);
    client.setQueryData(dealStageMetricsQueryOptions(updatedFilters).queryKey, []);

    await user.click(screen.getByRole("button", { name: /Менеджеры/ }));

    const annaAfterFilter = await screen.findByLabelText("Анна Савельева");
    const ivanAfterFilter = screen.getByLabelText("Иван Плахов");

    expect(annaAfterFilter).toBeChecked();
    expect(ivanAfterFilter).toBeChecked();
    expect(screen.queryByLabelText("Мария Орлова")).not.toBeInTheDocument();
    expect(useUiStore.getState().filters.managers).toEqual(
      expect.arrayContaining(["Анна Савельева", "Иван Плахов"]),
    );
  });

  it("показывает новых менеджеров из общего кэша без изменения фильтров", async () => {
    const client = createTestQueryClient();
    const filters = useUiStore.getState().filters;
    const managerFilters = createManagerFilters(filters);

    client.setQueryData(dealsQueryOptions(managerFilters).queryKey, dealsMock);
    client.setQueryData(dealsQueryOptions(filters).queryKey, dealsMock);
    client.setQueryData(dealStageMetricsQueryOptions(filters).queryKey, []);

    const user = userEvent.setup();

    renderWithQueryClient(<DealFunnelHeader />, client);

    await user.click(screen.getByRole("button", { name: /Менеджеры/ }));

    expect(screen.queryByLabelText("Дмитрий Сергеев")).not.toBeInTheDocument();

    await act(async () => {
      client.setQueryData(
        dealsQueryOptions(managerFilters).queryKey,
        (currentDeals: typeof dealsMock = dealsMock) => [
          ...currentDeals,
          {
            ...currentDeals[0],
            id: "deal-new",
            owner: "Дмитрий Сергеев",
            name: "Новый корпоративный полис",
          },
        ],
      );
    });

    expect(await screen.findByLabelText("Дмитрий Сергеев")).toBeInTheDocument();
  });

  it("ограничивает список менеджеров согласно активным фильтрам", async () => {
    const client = createTestQueryClient();

    await act(async () => {
      useUiStore.setState((state) => ({
        filters: {
          ...state.filters,
          stage: "proposal",
        },
      }));
    });

    const filters = useUiStore.getState().filters;
    const managerFilters = createManagerFilters(filters);
    const proposalDeals = dealsMock.filter((deal) => deal.stage === "proposal");

    client.setQueryData(dealsQueryOptions(managerFilters).queryKey, proposalDeals);
    client.setQueryData(dealsQueryOptions(filters).queryKey, proposalDeals);
    client.setQueryData(dealStageMetricsQueryOptions(filters).queryKey, []);

    const user = userEvent.setup();

    renderWithQueryClient(<DealFunnelHeader />, client);

    await user.click(screen.getByRole("button", { name: /Менеджеры/ }));

    expect(await screen.findByLabelText("Мария Орлова")).toBeInTheDocument();
    expect(screen.queryByLabelText("Анна Савельева")).not.toBeInTheDocument();
  });
});

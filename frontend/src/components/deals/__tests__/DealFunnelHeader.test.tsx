import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";

import { DealFunnelHeader } from "@/components/deals/DealFunnelHeader";
import { dealStageMetricsQueryOptions, dealsQueryOptions } from "@/lib/api/queries";
import { dealsMock } from "@/mocks/data";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";
import { useUiStore } from "@/stores/uiStore";

describe("DealFunnelHeader", () => {
  const initialState = useUiStore.getState();

  beforeEach(() => {
    useUiStore.setState(initialState, true);
  });

  it("отображает полученные метрики стадий", async () => {
    const client = createTestQueryClient();
    const filters = useUiStore.getState().filters;

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
});

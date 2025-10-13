import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { dealsQueryOptions } from "@/lib/api/queries";
import { dealsMock } from "@/mocks/data";
import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";
import { useUiStore } from "@/stores/uiStore";

vi.mock("@/lib/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/hooks")>("@/lib/api/hooks");

  return {
    ...actual,
    useUpdateDealStage: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

describe("DealFunnelBoard", () => {
  beforeAll(() => {
    act(() => {
      useUiStore.setState({
        isHintDismissed: () => true,
        dismissHint: () => undefined,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useUiStore.setState({ selectedDealIds: [] });
    });
  });

  it("отображает сделки по стадиям", async () => {
    const client = createTestQueryClient();
    client.setQueryData(dealsQueryOptions().queryKey, dealsMock);

    renderWithQueryClient(<DealFunnelBoard />, client);

    expect(await screen.findByText("Квалификация"));
    expect(screen.getByText("Переговоры"));
    expect(screen.getAllByText(/Страховка|ДМС|КАСКО/i).length).toBeGreaterThan(0);
  });

  it("показывает панель массовых действий при выборе сделок", async () => {
    const client = createTestQueryClient();
    client.setQueryData(dealsQueryOptions().queryKey, dealsMock);

    renderWithQueryClient(<DealFunnelBoard />, client);

    expect(await screen.findByText("Квалификация"));

    act(() => {
      const defaultSelection = dealsMock.slice(0, 2).map((deal) => deal.id);
      useUiStore.setState({ selectedDealIds: defaultSelection });
    });

    expect(await screen.findByRole("button", { name: "Назначить менеджера" })).toBeInTheDocument();
    expect(screen.getByText(/карточк/)).toBeInTheDocument();
  });
});

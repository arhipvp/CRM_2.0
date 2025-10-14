import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

import { HomeDealFunnelBoard } from "@/components/deals/HomeDealFunnelBoard";
import {
  DEFAULT_DEAL_FILTERS,
  areDealFiltersEqual,
  createDefaultDealFilters,
  type DealFiltersState,
} from "@/lib/utils/dealFilters";
import { DealViewMode, useUiStore } from "@/stores/uiStore";

type BoardSnapshot = {
  filters: ReturnType<typeof useUiStore.getState>["filters"];
  selectedDealIds: ReturnType<typeof useUiStore.getState>["selectedDealIds"];
  previewDealId: ReturnType<typeof useUiStore.getState>["previewDealId"];
  highlightedDealId: ReturnType<typeof useUiStore.getState>["highlightedDealId"];
  viewMode?: DealViewMode;
};

const boardRenderSpy = vi.fn<(snapshot: BoardSnapshot) => void>();

vi.mock("@/components/deals/DealFunnelBoard", () => ({
  DealFunnelBoard: ({ forceViewMode }: { forceViewMode?: DealViewMode }) => {
    const state = useUiStore.getState();
    boardRenderSpy({
      filters: {
        ...state.filters,
        managers: [...state.filters.managers],
      },
      selectedDealIds: [...state.selectedDealIds],
      previewDealId: state.previewDealId,
      highlightedDealId: state.highlightedDealId,
      viewMode: forceViewMode,
    });

    return (
      <div data-testid="deal-funnel-board" data-view-mode={forceViewMode ?? "kanban"} />
    );
  },
}));

function resetUiStore() {
  useUiStore.setState({
    filters: createDefaultDealFilters(),
    selectedDealIds: [],
    previewDealId: undefined,
    highlightedDealId: undefined,
    viewMode: "kanban",
  });
}

describe("HomeDealFunnelBoard", () => {
  beforeEach(() => {
    resetUiStore();
    boardRenderSpy.mockClear();
  });

  afterEach(() => {
    resetUiStore();
  });

  it("рендерит доску сразу, если состояние уже дефолтное", () => {
    render(<HomeDealFunnelBoard />);

    expect(screen.getByTestId("deal-funnel-board")).toBeInTheDocument();
    expect(boardRenderSpy).toHaveBeenCalledTimes(1);

    const snapshot = boardRenderSpy.mock.calls.at(-1)?.[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.selectedDealIds).toEqual([]);
    expect(snapshot?.previewDealId).toBeUndefined();
    expect(snapshot?.highlightedDealId).toBeUndefined();
    expect(areDealFiltersEqual(snapshot!.filters, DEFAULT_DEAL_FILTERS)).toBe(true);
  });

  it("сбрасывает фильтры и предпросмотр до первого кадра и восстанавливает при размонтировании", async () => {
    const store = useUiStore.getState();
    store.setSelectedStage("negotiation");
    store.selectDeals(["deal-1"]);
    store.openDealPreview("deal-2");
    store.highlightDeal("deal-3");

    const mutatedState = useUiStore.getState();

    const expectedStateBeforeMount: SavedUiState = {
      filters: {
        ...mutatedState.filters,
        managers: [...mutatedState.filters.managers],
      },
      selectedDealIds: [...mutatedState.selectedDealIds],
      previewDealId: mutatedState.previewDealId,
      highlightedDealId: mutatedState.highlightedDealId,
    };

    const { unmount } = render(<HomeDealFunnelBoard forceViewMode="kanban" />);

    const board = await screen.findByTestId("deal-funnel-board");
    expect(board).toBeInTheDocument();
    expect(boardRenderSpy).toHaveBeenCalledTimes(1);

    const snapshot = boardRenderSpy.mock.calls[0]?.[0];
    expect(snapshot).toBeDefined();
    expect(areDealFiltersEqual(snapshot!.filters, DEFAULT_DEAL_FILTERS)).toBe(true);
    expect(snapshot!.selectedDealIds).toEqual([]);
    expect(snapshot!.previewDealId).toBeUndefined();
    expect(snapshot!.highlightedDealId).toBeUndefined();
    expect(snapshot!.viewMode).toBe("kanban");

    unmount();

    const restored = useUiStore.getState();
    expect(areDealFiltersEqual(restored.filters, expectedStateBeforeMount.filters)).toBe(true);
    expect(restored.selectedDealIds).toEqual(expectedStateBeforeMount.selectedDealIds);
    expect(restored.previewDealId).toBe(expectedStateBeforeMount.previewDealId);
    expect(restored.highlightedDealId).toBe(expectedStateBeforeMount.highlightedDealId);
  });
});

type SavedUiState = {
  filters: DealFiltersState;
  selectedDealIds: string[];
  previewDealId?: string;
  highlightedDealId?: string;
};

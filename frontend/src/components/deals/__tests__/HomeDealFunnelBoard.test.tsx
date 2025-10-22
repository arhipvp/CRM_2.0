import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, screen } from "@testing-library/react";

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

type SavedUiState = {
  filters: DealFiltersState;
  selectedDealIds: string[];
  previewDealId?: string;
  highlightedDealId?: string;
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

  it("сохраняет пользовательские фильтры, выбор и предпросмотр при возврате на страницу сделок", async () => {
    const store = useUiStore.getState();
    store.setSelectedStage("proposal");
    store.selectDeals(["deal-before"]);
    store.openDealPreview("preview-before");
    store.highlightDeal("highlight-before");

    const { unmount } = render(<HomeDealFunnelBoard />);

    await screen.findByTestId("deal-funnel-board");

    await act(async () => {
      const currentStore = useUiStore.getState();
      currentStore.setSelectedStage("negotiation");
      currentStore.selectDeals(["home-1", "home-2"]);
      currentStore.openDealPreview("preview-home");
    });

    unmount();

    const finalState = useUiStore.getState();
    expect(finalState.selectedDealIds).toEqual(["home-1", "home-2"]);
    expect(finalState.previewDealId).toBe("preview-home");
    expect(finalState.filters.stage).toBe("negotiation");
    expect(finalState.highlightedDealId).toBe("highlight-before");
    expect(finalState.selectedDealIds).not.toContain("deal-before");
    expect(finalState.previewDealId).not.toBe("preview-before");
  });

  it("не перетирает подсветку, полученную во время работы виджета", async () => {
    const store = useUiStore.getState();
    store.setSelectedStage("proposal");
    store.selectDeals(["deal-4", "deal-5"]);
    store.openDealPreview("deal-6");
    store.highlightDeal("deal-7");

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

    const { unmount } = render(<HomeDealFunnelBoard />);

    const board = await screen.findByTestId("deal-funnel-board");
    expect(board).toBeInTheDocument();

    act(() => {
      useUiStore.getState().highlightDeal("deal-from-sse");
    });

    expect(useUiStore.getState().highlightedDealId).toBe("deal-from-sse");

    unmount();

    const restored = useUiStore.getState();
    expect(areDealFiltersEqual(restored.filters, expectedStateBeforeMount.filters)).toBe(true);
    expect(restored.selectedDealIds).toEqual(expectedStateBeforeMount.selectedDealIds);
    expect(restored.previewDealId).toBe(expectedStateBeforeMount.previewDealId);
    expect(restored.highlightedDealId).toBe("deal-from-sse");
  });
});

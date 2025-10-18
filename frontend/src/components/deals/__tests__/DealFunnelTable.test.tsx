import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { DealFunnelTable } from "@/components/deals/DealFunnelTable";
import { dealsMock } from "@/mocks/data";
import { useUiStore } from "@/stores/uiStore";

const useDealsMock = vi.fn();

function createDefaultUiState() {
  return {
    filters: { stage: "all", managers: [], period: "30d", search: "" },
    viewMode: "table" as const,
    selectedDealIds: [] as string[],
    highlightedDealId: undefined as string | undefined,
    previewDealId: undefined as string | undefined,
    notifications: [] as unknown[],
    dealUpdates: {} as Record<string, string>,
    dismissedHints: {} as Record<string, boolean>,
    setSelectedStage: vi.fn(),
    setManagersFilter: vi.fn(),
    toggleManagerFilter: vi.fn(),
    setPeriodFilter: vi.fn(),
    setSearchFilter: vi.fn(),
    clearFilters: vi.fn(),
    setViewMode: vi.fn(),
    toggleDealSelection: vi.fn(),
    selectDeals: vi.fn(),
    clearSelection: vi.fn(),
    openDealPreview: vi.fn(),
    isHintDismissed: () => false,
    dismissHint: vi.fn(),
    highlightDeal: vi.fn(),
    pushNotification: vi.fn(),
    dismissNotification: vi.fn(),
    handlePaymentEvent: vi.fn(),
  };
}

vi.mock("@/components/deals/DealPreviewSidebar", () => ({
  DealPreviewSidebar: () => null,
}));

vi.mock("@/components/deals/DealBulkActions", () => ({
  DealBulkActions: () => null,
  buildBulkActionNotificationMessage: vi.fn(() => ""),
}));

vi.mock("@/stores/uiStore", () => {
  const { create } = require("zustand");

  type BaseUiState = ReturnType<typeof createDefaultUiState>;
  type UiState = BaseUiState & {
    markDealUpdated: (dealId: string) => void;
    clearDealUpdate: (dealId: string) => void;
  };

  const useUiStoreMock = create<UiState>((set) => ({
    ...createDefaultUiState(),
    markDealUpdated: vi.fn((dealId: string) => {
      set((state) => ({
        dealUpdates: {
          ...state.dealUpdates,
          [dealId]: new Date().toISOString(),
        },
      }));
    }),
    clearDealUpdate: vi.fn((dealId: string) => {
      set((state) => {
        const rest = { ...state.dealUpdates };
        delete rest[dealId];
        return { dealUpdates: rest };
      });
    }),
  }));

  (useUiStoreMock as typeof useUiStoreMock & { resetState?: () => void }).resetState = () => {
    const base = createDefaultUiState();
    useUiStoreMock.setState((state) => ({
      ...state,
      ...base,
    }));
  };

  return {
    useUiStore: useUiStoreMock,
  };
});

vi.mock("@/lib/api/hooks", () => ({
  useDeals: (...args: unknown[]) => useDealsMock(...args),
}));

const mockedUseUiStore = useUiStore as typeof useUiStore & { resetState?: () => void };

function resetUiStore() {
  mockedUseUiStore.resetState?.();
}

function renderTable() {
  let result: ReturnType<typeof render> | undefined;

  act(() => {
    result = render(<DealFunnelTable />);
  });

  return result!;
}

describe("DealFunnelTable — deal updates", () => {
  beforeEach(() => {
    resetUiStore();
    useDealsMock.mockReturnValue({
      data: dealsMock,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockedUseUiStore.setState({ viewMode: "table" });
  });

  afterEach(() => {
    resetUiStore();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("подсвечивает строку и очищает подсветку после markDealUpdated", async () => {
    vi.useFakeTimers();

    renderTable();

    const targetDeal = dealsMock[0];

    const dealCell = screen.getByText(targetDeal.id);

    act(() => {
      mockedUseUiStore.getState().markDealUpdated(targetDeal.id);
    });

    const row = dealCell.closest("tr");
    expect(row).not.toBeNull();
    const rowElement = row as HTMLElement;

    expect(rowElement).toHaveClass("deal-update-highlight");

    await act(async () => {
      await Promise.resolve();
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      vi.runAllTimers();
    });

    expect(rowElement).not.toHaveClass("deal-update-highlight");

    vi.useRealTimers();

    const clearDealUpdateMock = mockedUseUiStore.getState().clearDealUpdate as ReturnType<typeof vi.fn>;
    expect(clearDealUpdateMock).toHaveBeenCalledWith(targetDeal.id);
  });
});

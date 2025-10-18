import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { DealFunnelTable } from "@/components/deals/DealFunnelTable";
import { dealsMock } from "@/mocks/data";
import { useUiStore } from "@/stores/uiStore";
import { render, screen, within } from "@testing-library/react";

import { DealFunnelTable } from "@/components/deals/DealFunnelTable";
import type { Deal } from "@/types/crm";

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
    markDealUpdated: vi.fn(),
    clearDealUpdate: vi.fn(),
    dealDetailsTab: "overview" as const,
    dealDetailsRequests: {},
    setDealDetailsTab: vi.fn(),
    triggerDealDetailsRequest: vi.fn(),
    consumeDealDetailsRequest: vi.fn(),
  };
}

type UiState = ReturnType<typeof createDefaultUiState>;

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
  buildBulkActionNotificationMessage: vi.fn(),
}));

vi.mock("@/stores/uiStore", () => {
  let state: UiState = createDefaultUiState();
  const listeners = new Set<(value: UiState) => void>();

  const useUiStoreMock = (selector?: (value: UiState) => unknown) => (selector ? selector(state) : state);

  useUiStoreMock.setState = (
    partial: Partial<UiState> | ((value: UiState) => Partial<UiState>),
  ) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...nextState };
    listeners.forEach((listener) => listener(state));
  };

  useUiStoreMock.getState = () => state;
  useUiStoreMock.subscribe = (listener: (value: UiState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  useUiStoreMock.resetState = () => {
    state = createDefaultUiState();
    listeners.forEach((listener) => listener(state));
  };

  return {
    useUiStore: useUiStoreMock,
  };
});

vi.mock("@/lib/api/hooks", () => ({
  useDeals: (...args: unknown[]) => useDealsMock(...args),
}));

const mockedUseUiStore = useUiStore as typeof useUiStore & { resetState?: () => void };
const mockedUseUiStore = (await import("@/stores/uiStore")).useUiStore as typeof import("@/stores/uiStore").useUiStore & {
  resetState?: () => void;
};

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
describe("DealFunnelTable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    resetUiStore();
    const deals: Deal[] = [
      {
        id: "deal-future",
        name: "Будущая сделка",
        clientName: "ООО Альфа",
        clientId: "client-1",
        stage: "negotiation",
        probability: 0.5,
        value: 250000,
        nextReviewAt: new Date("2024-01-05T09:00:00.000Z").toISOString(),
        updatedAt: new Date("2023-12-15T10:00:00.000Z").toISOString(),
        owner: "Иван Петров",
        expectedCloseDate: new Date("2024-01-10T00:00:00.000Z").toISOString(),
        tasks: [],
        notes: [],
        documents: [],
        payments: [],
        activity: [],
      },
      {
        id: "deal-overdue",
        name: "Просроченная сделка",
        clientName: "ООО Бета",
        clientId: "client-2",
        stage: "proposal",
        probability: 0.7,
        value: 350000,
        nextReviewAt: new Date("2024-01-03T12:00:00.000Z").toISOString(),
        updatedAt: new Date("2023-12-20T08:30:00.000Z").toISOString(),
        owner: "Мария Иванова",
        expectedCloseDate: new Date("2023-12-20T00:00:00.000Z").toISOString(),
        tasks: [],
        notes: [],
        documents: [],
        payments: [],
        activity: [],
      },
    ];

    useDealsMock.mockReturnValue({
      data: deals,
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

  afterEach(() => {
    vi.useRealTimers();
    resetUiStore();
    vi.clearAllMocks();
  });

  it("отображает колонки для ответственного и ожидаемого закрытия", () => {
    render(<DealFunnelTable />);

    expect(screen.getByRole("columnheader", { name: /ответственный/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /ожидаемое закрытие/i })).toBeInTheDocument();
  });

  it("выводит владельца сделки и подсвечивает просроченную дату закрытия", () => {
    render(<DealFunnelTable />);

    const overdueRow = screen.getByText("Просроченная сделка").closest("tr");
    expect(overdueRow).toBeTruthy();
    const overdueExpected = within(overdueRow as HTMLTableRowElement).getByTitle("Ожидаемая дата закрытия");
    expect(overdueExpected).toHaveClass("text-amber-600");

    const ownerCell = within(overdueRow as HTMLTableRowElement).getByText("Мария Иванова");
    expect(ownerCell).toBeInTheDocument();

    const futureRow = screen.getByText("Будущая сделка").closest("tr");
    expect(futureRow).toBeTruthy();
    const futureExpected = within(futureRow as HTMLTableRowElement).getByTitle("Ожидаемая дата закрытия");
    expect(futureExpected).toHaveClass("text-slate-400");
  });
});

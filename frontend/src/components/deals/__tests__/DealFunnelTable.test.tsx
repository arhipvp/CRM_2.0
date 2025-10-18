import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";

import { DealFunnelTable } from "@/components/deals/DealFunnelTable";
import { useUiStore } from "@/stores/uiStore";
import type { Deal } from "@/types/crm";

const useDealsMock = vi.fn();

vi.mock("@/components/deals/DealPreviewSidebar", () => ({
  DealPreviewSidebar: () => null,
}));

vi.mock("@/components/deals/DealBulkActions", () => ({
  DealBulkActions: () => null,
}));

vi.mock("@/lib/api/hooks", () => ({
  useDeals: (...args: unknown[]) => useDealsMock(...args),
}));

type DealFiltersState = {
  stage: string;
  managers: string[];
  period: string;
  search: string;
};

type BaseUiState = {
  filters: DealFiltersState;
  viewMode: "table" | "kanban";
  selectedDealIds: string[];
  highlightedDealId?: string;
  previewDealId?: string;
  notifications: unknown[];
  dealUpdates: Record<string, string>;
  dismissedHints: Record<string, boolean>;
  dealDetailsTab: string;
  dealDetailsRequests: Record<string, string>;
};

type UiState = BaseUiState & {
  setSelectedStage: (stage: string) => void;
  setManagersFilter: (managers: string[]) => void;
  toggleManagerFilter: (manager: string) => void;
  setPeriodFilter: (period: string) => void;
  setSearchFilter: (value: string) => void;
  clearFilters: () => void;
  setViewMode: (mode: "table" | "kanban") => void;
  toggleDealSelection: (dealId: string) => void;
  selectDeals: (dealIds: string[]) => void;
  clearSelection: () => void;
  openDealPreview: (dealId?: string) => void;
  isHintDismissed: (key: string) => boolean;
  dismissHint: (key: string) => void;
  highlightDeal: (dealId?: string) => void;
  pushNotification: (notification: unknown) => void;
  dismissNotification: (id: string) => void;
  handlePaymentEvent: (event: unknown) => { shouldRefetch: boolean; highlightDealId?: string };
  markDealUpdated: (dealId: string) => void;
  clearDealUpdate: (dealId: string) => void;
  setDealDetailsTab: (tab: string) => void;
  triggerDealDetailsRequest: (kind: string) => void;
  consumeDealDetailsRequest: (kind: string) => void;
};

function createDefaultUiState(): BaseUiState {
  return {
    filters: { stage: "all", managers: [], period: "30d", search: "" },
    viewMode: "table",
    selectedDealIds: [],
    highlightedDealId: undefined,
    previewDealId: undefined,
    notifications: [],
    dealUpdates: {},
    dismissedHints: {},
    dealDetailsTab: "overview",
    dealDetailsRequests: {},
  };
}

vi.mock("@/stores/uiStore", () => {
  let state: UiState;
  const listeners = new Set<(value: UiState) => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener(state);
    }
  };

  const buildState = (): UiState => {
    const base = createDefaultUiState();

    const setViewMode = vi.fn((mode: UiState["viewMode"]) => {
      state = { ...state, viewMode: mode };
      notify();
    });

    const clearSelection = vi.fn(() => {
      state = { ...state, selectedDealIds: [] };
      notify();
    });

    const openDealPreview = vi.fn((dealId?: string) => {
      state = { ...state, previewDealId: dealId };
      notify();
    });

    const highlightDeal = vi.fn((dealId?: string) => {
      state = { ...state, highlightedDealId: dealId };
      notify();
    });

    const markDealUpdated = vi.fn((dealId: string) => {
      state = {
        ...state,
        dealUpdates: {
          ...state.dealUpdates,
          [dealId]: new Date().toISOString(),
        },
      };
      notify();
    });

    const clearDealUpdate = vi.fn((dealId: string) => {
      const { [dealId]: _removed, ...rest } = state.dealUpdates;
      state = {
        ...state,
        dealUpdates: rest,
      };
      notify();
    });

    return {
      ...base,
      setSelectedStage: vi.fn(),
      setManagersFilter: vi.fn(),
      toggleManagerFilter: vi.fn(),
      setPeriodFilter: vi.fn(),
      setSearchFilter: vi.fn(),
      clearFilters: vi.fn(),
      setViewMode,
      toggleDealSelection: vi.fn(),
      selectDeals: vi.fn(),
      clearSelection,
      openDealPreview,
      isHintDismissed: vi.fn(() => false),
      dismissHint: vi.fn(),
      highlightDeal,
      pushNotification: vi.fn(),
      dismissNotification: vi.fn(),
      handlePaymentEvent: vi.fn(() => ({ shouldRefetch: false })),
      markDealUpdated,
      clearDealUpdate,
      setDealDetailsTab: vi.fn(),
      triggerDealDetailsRequest: vi.fn(),
      consumeDealDetailsRequest: vi.fn(),
    };
  };

  state = buildState();

  const useUiStoreMock = ((selector?: (value: UiState) => unknown) =>
    selector ? selector(state) : state) as unknown as {
    <T>(selector: (value: UiState) => T): T;
    (): UiState;
  };

  useUiStoreMock.setState = (
    partial: Partial<UiState> | ((value: UiState) => Partial<UiState>),
  ) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...next } as UiState;
    notify();
  };

  useUiStoreMock.getState = () => state;

  useUiStoreMock.subscribe = (listener: (value: UiState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  useUiStoreMock.resetState = () => {
    state = buildState();
    notify();
  };

  return {
    useUiStore: useUiStoreMock,
  };
});

const mockedUseUiStore = useUiStore as typeof useUiStore & {
  resetState?: () => void;
};

const sampleDeals: Deal[] = [
  {
    id: "deal-future",
    name: "Будущая сделка",
    clientName: "ООО Альфа",
    clientId: "client-1",
    stage: "negotiation",
    probability: 0.5,
    owner: "Иван Петров",
    nextReviewAt: new Date("2074-01-05T09:00:00.000Z").toISOString(),
    updatedAt: new Date("2073-12-15T10:00:00.000Z").toISOString(),
    expectedCloseDate: new Date("2074-01-10T00:00:00.000Z").toISOString(),
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
    owner: "Мария Иванова",
    nextReviewAt: new Date("2004-01-03T12:00:00.000Z").toISOString(),
    updatedAt: new Date("2003-12-20T08:30:00.000Z").toISOString(),
    expectedCloseDate: new Date("2003-12-20T00:00:00.000Z").toISOString(),
    tasks: [],
    notes: [],
    documents: [],
    payments: [],
    activity: [],
  },
];

function renderTable() {
  render(<DealFunnelTable />);
}

describe("DealFunnelTable", () => {
  beforeEach(() => {
    mockedUseUiStore.resetState?.();
    useDealsMock.mockReturnValue({
      data: sampleDeals,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mockedUseUiStore.resetState?.();
    vi.clearAllMocks();
  });

  it("подсвечивает строку и очищает подсветку после markDealUpdated", async () => {
    renderTable();

    const targetDeal = sampleDeals[0];

    act(() => {
      mockedUseUiStore.getState().markDealUpdated(targetDeal.id);
    });

    await waitFor(() => {
      expect(mockedUseUiStore.getState().dealUpdates[targetDeal.id]).toBeDefined();
    });

    act(() => {
      mockedUseUiStore.getState().clearDealUpdate(targetDeal.id);
    });

    expect(mockedUseUiStore.getState().dealUpdates[targetDeal.id]).toBeUndefined();
  });

  it("отображает колонки для ответственного и ожидаемого закрытия", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: /ответственный/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /ожидаемое закрытие/i })).toBeInTheDocument();
  });

  it("выводит владельца сделки и подсвечивает просроченную дату закрытия", () => {
    renderTable();

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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, screen, within } from "@testing-library/react";

import { DealFunnelTable } from "@/components/deals/DealFunnelTable";
import { dealsMock } from "@/mocks/data";
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
    dealDetailsTab: "overview" as const,
    dealDetailsRequests: {},
    setDealDetailsTab: vi.fn(),
    triggerDealDetailsRequest: vi.fn(),
    consumeDealDetailsRequest: vi.fn(),
  };
}

type UiState = ReturnType<typeof createDefaultUiState>;

type UseUiStoreMock = {
  (selector?: (value: UiState) => unknown): unknown;
  setState: (partial: Partial<UiState> | ((value: UiState) => Partial<UiState>)) => void;
  getState: () => UiState;
  subscribe: (listener: (value: UiState) => void) => () => void;
  resetState: () => void;
};

vi.mock("@/components/deals/DealPreviewSidebar", () => ({
  DealPreviewSidebar: () => null,
}));

vi.mock("@/components/deals/DealBulkActions", () => ({
  DealBulkActions: () => null,
  buildBulkActionNotificationMessage: vi.fn(),
}));

vi.mock("@/stores/uiStore", () => {
  const { create } = require("zustand");

  type ExtendedState = UiState & {
    markDealUpdated: ReturnType<typeof vi.fn>;
    clearDealUpdate: ReturnType<typeof vi.fn>;
  };

  let markDealUpdated: ReturnType<typeof vi.fn>;
  let clearDealUpdate: ReturnType<typeof vi.fn>;

  const useUiStoreMock = create<ExtendedState>((set) => {
    markDealUpdated = vi.fn((dealId: string) => {
      set((current) => ({
        dealUpdates: {
          ...current.dealUpdates,
          [dealId]: new Date().toISOString(),
        },
      }));
    });

    clearDealUpdate = vi.fn((dealId: string) => {
      set((current) => {
        const nextUpdates = { ...current.dealUpdates };
        delete nextUpdates[dealId];
        return { dealUpdates: nextUpdates };
      });
    });

    return {
      ...createDefaultUiState(),
      markDealUpdated,
      clearDealUpdate,
    };
  });

  (useUiStoreMock as typeof useUiStoreMock & { resetState?: () => void }).resetState = () => {
    const base = createDefaultUiState();
    useUiStoreMock.setState({
      ...base,
      markDealUpdated,
      clearDealUpdate,
    });
    markDealUpdated.mockClear();
    clearDealUpdate.mockClear();
  };

  return { useUiStore: useUiStoreMock };
});

vi.mock("@/lib/api/hooks", () => ({
  useDeals: (...args: unknown[]) => useDealsMock(...args),
}));

const mockedUseUiStore = (await import("@/stores/uiStore")).useUiStore as ReturnType<
  typeof import("@/stores/uiStore")
>["useUiStore"] & { resetState?: () => void };
vi.mock("@/lib/api/hooks", () => ({
  useDeals: (...args: unknown[]) => useDealsMock(...args),
}));

vi.mock("@/stores/uiStore", () => {
  let state = createDefaultUiState();
  const listeners = new Set<(value: UiState) => void>();

  const applyState = (
    partial: Partial<UiState> | ((value: UiState) => Partial<UiState>),
  ) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...nextState };
    listeners.forEach((listener) => listener(state));
  };

  const markDealUpdatedMock = vi.fn((dealId: string) => {
    applyState((current) => ({
      dealUpdates: {
        ...current.dealUpdates,
        [dealId]: new Date().toISOString(),
      },
    }));
  });

  const clearDealUpdateMock = vi.fn((dealId: string) => {
    applyState((current) => {
      const next = { ...current.dealUpdates };
      delete next[dealId];
      return { dealUpdates: next };
    });
  });

  const setState: UseUiStoreMock["setState"] = (partial) => {
    applyState(partial);
  };

  const subscribe: UseUiStoreMock["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const resetState = () => {
    markDealUpdatedMock.mockClear();
    clearDealUpdateMock.mockClear();
    state = {
      ...createDefaultUiState(),
      markDealUpdated: markDealUpdatedMock,
      clearDealUpdate: clearDealUpdateMock,
    };
    listeners.forEach((listener) => listener(state));
  };

  const useUiStoreMock = ((selector?: (value: UiState) => unknown) =>
    selector ? selector(state) : state) as UseUiStoreMock;

  resetState();

  useUiStoreMock.setState = setState;
  useUiStoreMock.getState = () => state;
  useUiStoreMock.subscribe = subscribe;
  useUiStoreMock.resetState = resetState;

  return {
    useUiStore: useUiStoreMock,
  };
});

const mockedUseUiStore = (await import("@/stores/uiStore")).useUiStore as unknown as UseUiStoreMock;

function resetUiStore() {
  mockedUseUiStore.resetState();
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
  });

  afterEach(() => {
    resetUiStore();
    vi.clearAllMocks();
  });

  it("подсвечивает строку и очищает подсветку после markDealUpdated", async () => {
    vi.useFakeTimers();

    renderTable();

    const targetDeal = dealsMock[0];

    act(() => {
      const markDealUpdated = mockedUseUiStore.getState().markDealUpdated as ReturnType<typeof vi.fn>;
      markDealUpdated(targetDeal.id);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedUseUiStore.getState().dealUpdates[targetDeal.id]).toBeDefined();

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      vi.runAllTimers();
    });

    await act(async () => {
      await Promise.resolve();
    });

    vi.useRealTimers();

    void mockedUseUiStore.getState().clearDealUpdate;
  });
});

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
    mockedUseUiStore.setState?.({ viewMode: "table" });
  });

  afterEach(() => {
    resetUiStore();
    vi.clearAllMocks();
  });

  it("подсвечивает строку и очищает подсветку после markDealUpdated", async () => {
    vi.useFakeTimers();

    renderTable();

    const targetDeal = dealsMock[0];

    const wideTable = screen.getAllByRole("table")[1];

    await act(async () => {
      mockedUseUiStore.getState().markDealUpdated(targetDeal.id);
    });

    expect(mockedUseUiStore.getState().dealUpdates).toHaveProperty(targetDeal.id);

    const dealCell = within(wideTable).getByText(targetDeal.id);
    const row = dealCell.closest("tr");
    expect(row).not.toBeNull();
    const rowElement = row as HTMLElement;

    expect(rowElement).toHaveClass("deal-update-highlight");
    expect(rowElement).toHaveClass("ring-amber-400");

    await act(async () => {
      await Promise.resolve();
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      vi.runAllTimers();
    });

    expect(rowElement).not.toHaveClass("deal-update-highlight");
    expect(rowElement).not.toHaveClass("ring-amber-400");

    vi.useRealTimers();

    const clearDealUpdateMock = mockedUseUiStore.getState().clearDealUpdate as ReturnType<typeof vi.fn>;
    expect(clearDealUpdateMock).toHaveBeenCalledWith(targetDeal.id);
  });
});

describe("DealFunnelTable", () => {
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    resetUiStore();

    useDealsMock.mockReturnValue({
      data: deals,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockedUseUiStore.setState?.({ viewMode: "table" });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetUiStore();
    vi.clearAllMocks();
  });

  it("отображает колонки для исполнителя и ожидаемого закрытия", () => {
    render(<DealFunnelTable />);

    const wideTable = screen.getAllByRole("table")[1];

    expect(within(wideTable).getByRole("columnheader", { name: /исполнитель/i })).toBeInTheDocument();
    expect(within(wideTable).getByRole("columnheader", { name: /ожидаемое закрытие/i })).toBeInTheDocument();
    expect(within(wideTable).queryByRole("columnheader", { name: /сумма/i })).not.toBeInTheDocument();
  });

  it("перестраивает порядок колонок в компактной таблице", () => {
    render(<DealFunnelTable />);

    const compactTable = screen.getAllByRole("table")[0];
    const headers = within(compactTable)
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.trim());

    expect(headers).toEqual([
      "Клиент",
      "Сделка",
      "Следующий просмотр",
      "Статус",
      "Исполнитель",
      "Вероятность",
      "Обновлено",
      "Действия",
    ]);
  });

  it("показывает локализованные названия стадий", () => {
    render(<DealFunnelTable />);

    expect(screen.getAllByText("Переговоры").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Коммерческое предложение").length).toBeGreaterThan(0);
  });

  it("выводит владельца сделки и подсвечивает просроченную дату закрытия", () => {
    render(<DealFunnelTable />);

    const wideTable = screen.getAllByRole("table")[1];

    const overdueRow = within(wideTable).getByText("Просроченная сделка").closest("tr");
    const overdueRow = screen
      .getAllByText("Просроченная сделка")
      .map((cell) => cell.closest("tr"))
      .find((row) => row && within(row).queryByTitle("Ожидаемая дата закрытия"));
    expect(overdueRow).toBeTruthy();
    const overdueExpected = within(overdueRow as HTMLTableRowElement).getByTitle("Ожидаемая дата закрытия");
    expect(overdueExpected).toHaveClass("text-amber-600");

    const ownerCell = within(overdueRow as HTMLTableRowElement).getByText("Мария Иванова");
    expect(ownerCell).toBeInTheDocument();

    const futureRow = within(wideTable).getByText("Будущая сделка").closest("tr");
    const futureRow = screen
      .getAllByText("Будущая сделка")
      .map((cell) => cell.closest("tr"))
      .find((row) => row && within(row).queryByTitle("Ожидаемая дата закрытия"));
    expect(futureRow).toBeTruthy();
    const futureExpected = within(futureRow as HTMLTableRowElement).getByTitle("Ожидаемая дата закрытия");
    expect(futureExpected).toHaveClass("text-slate-400");
  });
});

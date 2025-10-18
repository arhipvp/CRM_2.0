import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { dealsMock } from "@/mocks/data";
import type { Deal } from "@/types/crm";
import { useUiStore } from "@/stores/uiStore";

const useDealsMock = vi.fn();
const mutateMock = vi.fn();

function createDefaultUiState() {
  return {
    filters: { stage: "all", managers: [], period: "30d", search: "" },
    viewMode: "kanban" as const,
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

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  DragOverlay: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children ?? null),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDraggable: () => ({
    setNodeRef: vi.fn(),
    listeners: {},
    attributes: {},
    transform: null,
    isDragging: false,
  }),
  useSensor: () => ({}),
  useSensors: (...args: unknown[]) => args,
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  sortableKeyboardCoordinates: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Translate: { toString: () => "" } },
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
  useUpdateDealStage: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

const mockedUseUiStore = useUiStore as typeof useUiStore & { resetState?: () => void };

function resetUiStore() {
  mockedUseUiStore.resetState?.();
}

function renderBoard(props?: Parameters<typeof DealFunnelBoard>[0]) {
  let result: ReturnType<typeof render> | undefined;

  act(() => {
    result = render(<DealFunnelBoard {...props} />);
  });

  return result!;
}

describe("DealFunnelBoard — next review", () => {
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
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("отображает дату следующего просмотра на карточках", async () => {
    renderBoard();

    const qualificationColumn = await screen.findByRole("region", { name: "Квалификация" });
    const cards = await within(qualificationColumn).findAllByRole("button", { name: /Сделка/i });
    const card = cards.find((item) => item.getAttribute("aria-label")?.includes("Корпоративная страховка"));

    expect(card).toBeDefined();
    expect(within(card as HTMLElement).getByText(/Следующий просмотр/i)).toBeInTheDocument();
  });

  it("сортирует карточки по возрастанию nextReviewAt внутри стадии", async () => {
    const baseDate = new Date("2024-01-01T00:00:00.000Z").getTime();
    const dayInMs = 86_400_000;
    const qualificationDeals: Deal[] = dealsMock.slice(0, 3).map((deal, index) => ({
      ...deal,
      stage: "qualification",
      nextReviewAt: new Date(baseDate + index * dayInMs).toISOString(),
    }));

    const shuffledDeals = [qualificationDeals[2], qualificationDeals[0], qualificationDeals[1]];
    useDealsMock.mockReturnValue({
      data: shuffledDeals,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderBoard();

    const column = await screen.findByRole("region", { name: "Квалификация" });
    const cards = await within(column).findAllByRole("button", { name: /Сделка/i });

    const titles = cards
      .map((card) => card.getAttribute("aria-label") ?? "")
      .map((label) => label.match(/^Сделка (.+?) для клиента/u)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(titles).toHaveLength(qualificationDeals.length);
    const expectedOrder = [...qualificationDeals].sort(
      (a, b) => new Date(a.nextReviewAt!).getTime() - new Date(b.nextReviewAt!).getTime(),
    );
    expect(titles).toEqual(expectedOrder.map((deal) => deal.name));
  });

  it("использует updatedAt как резервную сортировку, когда nextReviewAt совпадает", async () => {
    const nextReview = new Date("2024-02-01T10:00:00.000Z").toISOString();
    const qualificationDeals: Deal[] = dealsMock.slice(0, 3).map((deal, index) => ({
      ...deal,
      stage: "qualification",
      nextReviewAt: nextReview,
      updatedAt: new Date(Date.UTC(2024, 1, 1, index)).toISOString(),
      name: `${deal.name} ${index + 1}`,
    }));

    const shuffledDeals = [qualificationDeals[1], qualificationDeals[2], qualificationDeals[0]];
    useDealsMock.mockReturnValue({
      data: shuffledDeals,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    renderBoard();

    const column = await screen.findByRole("region", { name: "Квалификация" });
    const cards = await within(column).findAllByRole("button", { name: /Сделка/i });

    const titles = cards
      .map((card) => card.getAttribute("aria-label") ?? "")
      .map((label) => label.match(/^Сделка (.+?) для клиента/u)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(titles).toHaveLength(qualificationDeals.length);
    const expectedOrder = [...qualificationDeals].sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    );
    expect(titles).toEqual(expectedOrder.map((deal) => deal.name));
  });

  it("показывает заглушку массовых действий и скрывает её после подтверждения", async () => {
    const selectedIds = dealsMock.slice(0, 2).map((deal) => deal.id);
    const clearSelectionSpy = vi.fn();
    const user = userEvent.setup();

    mockedUseUiStore.setState?.((state) => ({
      ...state,
      selectedDealIds: selectedIds,
      clearSelection: clearSelectionSpy,
    }));

    render(<DealFunnelBoard />);

    const panel = await screen.findByRole("region", { name: "Массовые действия со сделками" });
    expect(within(panel).getByText(/Массовые действия в разработке/i)).toBeInTheDocument();

    const closeButton = within(panel).getByRole("button", { name: "Понятно" });
    await user.click(closeButton);

    expect(clearSelectionSpy).toHaveBeenCalledTimes(1);
  });
});

describe("DealFunnelBoard — deal updates", () => {
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
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("подсвечивает сделку после markDealUpdated и очищает подсветку", async () => {
    vi.useFakeTimers();

    renderBoard();

    const targetDeal = dealsMock[0];

    act(() => {
      mockedUseUiStore.getState().markDealUpdated(targetDeal.id);
    });

    const card = screen.getByRole("button", {
      name: new RegExp(`Сделка ${targetDeal.name}`, "i"),
    });

    expect(card).toHaveClass("deal-update-highlight");

    await act(async () => {
      await Promise.resolve();
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      vi.runAllTimers();
    });

    expect(card).not.toHaveClass("deal-update-highlight");

    vi.useRealTimers();

    const clearDealUpdateMock = mockedUseUiStore.getState().clearDealUpdate as ReturnType<typeof vi.fn>;
    expect(clearDealUpdateMock).toHaveBeenCalledWith(targetDeal.id);
  });
});

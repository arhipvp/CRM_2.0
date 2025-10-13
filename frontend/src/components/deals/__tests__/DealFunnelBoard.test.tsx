import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";

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
    markDealUpdated: vi.fn(),
    clearDealUpdate: vi.fn(),
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
  type UiState = ReturnType<typeof createDefaultUiState>;
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
  useUpdateDealStage: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

const mockedUseUiStore = useUiStore as typeof useUiStore & { resetState?: () => void };

function resetUiStore() {
  mockedUseUiStore.resetState?.();
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
    vi.clearAllMocks();
  });

  it("отображает дату следующего просмотра на карточках", async () => {
    render(<DealFunnelBoard />);

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

    render(<DealFunnelBoard />);

    const column = await screen.findByRole("region", { name: "Квалификация" });
    const cards = await within(column).findAllByRole("button", { name: /Сделка/i });

    const titles = cards
      .map((card) => card.getAttribute("aria-label") ?? "")
      .map((label) => label.match(/^Сделка (.+?) для клиента/u)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(titles).toHaveLength(qualificationDeals.length);
    expect(titles).toEqual(qualificationDeals.map((deal) => deal.name));
  });
});

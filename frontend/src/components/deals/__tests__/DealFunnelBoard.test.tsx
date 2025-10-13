import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";

const dndHandlers: {
  onDragStart?: (event: unknown) => void;
  onDragEnd?: (event: unknown) => void;
  onDragCancel?: (event: unknown) => void;
} = {};

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");

  return {
    ...actual,
    DndContext: ({ children, onDragEnd, onDragStart, onDragCancel }: any) => {
      dndHandlers.onDragEnd = onDragEnd;
      dndHandlers.onDragStart = onDragStart;
      dndHandlers.onDragCancel = onDragCancel;
      return <div data-testid="dnd-context">{children}</div>;
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
    useDraggable: () => ({
      setNodeRef: vi.fn(),
      listeners: {},
      attributes: {},
      transform: null,
      isDragging: false,
    }),
    useSensors: actual.useSensors,
    useSensor: actual.useSensor,
    PointerSensor: actual.PointerSensor,
    KeyboardSensor: actual.KeyboardSensor,
  } satisfies typeof actual;
});

vi.mock("@/stores/uiStore", async () => {
  const actual = await vi.importActual<typeof import("@/stores/uiStore")>("@/stores/uiStore");
  const { create } = await vi.importActual<typeof import("zustand")>("zustand");

  const initialFilters = { stage: "all", managers: [], period: "all", search: "" } as const;

  const useUiStore = create((set, get) => ({
    filters: { ...initialFilters },
    viewMode: "kanban" as const,
    selectedDealIds: [] as string[],
    highlightedDealId: undefined as string | undefined,
    previewDealId: undefined as string | undefined,
    notifications: [] as ReturnType<typeof actual.useUiStore.getState>["notifications"],
    dealUpdates: {} as Record<string, string>,
    dismissedHints: new Set<string>(),
    setSelectedStage: (stage: string | "all") =>
      set((state: any) => ({ filters: { ...state.filters, stage } })),
    setManagersFilter: (managers: string[]) =>
      set((state: any) => ({ filters: { ...state.filters, managers } })),
    toggleManagerFilter: (manager: string) =>
      set((state: any) => {
        const has = state.filters.managers.includes(manager);
        const managers = has
          ? state.filters.managers.filter((item: string) => item !== manager)
          : [...state.filters.managers, manager];
        return { filters: { ...state.filters, managers } };
      }),
    setPeriodFilter: (period: string) =>
      set((state: any) => ({ filters: { ...state.filters, period } })),
    setSearchFilter: (value: string) =>
      set((state: any) => ({ filters: { ...state.filters, search: value } })),
    clearFilters: () => set({ filters: { ...initialFilters } }),
    setViewMode: (mode: string) => set({ viewMode: mode }),
    toggleDealSelection: (dealId: string) =>
      set((state: any) => {
        const selected = state.selectedDealIds.includes(dealId)
          ? state.selectedDealIds.filter((id: string) => id !== dealId)
          : [...state.selectedDealIds, dealId];
        return { selectedDealIds: selected };
      }),
    selectDeals: (ids: string[]) => set({ selectedDealIds: [...ids] }),
    clearSelection: () => set({ selectedDealIds: [] }),
    openDealPreview: (dealId: string | undefined) => set({ previewDealId: dealId ?? undefined }),
    isHintDismissed: (key: string) => get().dismissedHints.has(key),
    dismissHint: (key: string) =>
      set((state: any) => {
        const next = new Set<string>(state.dismissedHints);
        next.add(key);
        return { dismissedHints: next };
      }),
    highlightDeal: (dealId: string | undefined) => set({ highlightedDealId: dealId ?? undefined }),
    pushNotification: (notification: any) =>
      set((state: any) => ({
        notifications: [notification, ...state.notifications].slice(0, 20),
      })),
    dismissNotification: (id: string) =>
      set((state: any) => ({
        notifications: state.notifications.filter((item: any) => item.id !== id),
      })),
    handlePaymentEvent: () => ({ shouldRefetch: false }),
    markDealUpdated: (dealId: string) =>
      set((state: any) => ({
        dealUpdates: { ...state.dealUpdates, [dealId]: new Date().toISOString() },
      })),
    clearDealUpdate: (dealId: string) =>
      set((state: any) => {
        const next = { ...state.dealUpdates };
        delete next[dealId];
        return { dealUpdates: next };
      }),
  })) as typeof actual.useUiStore;

  const resetStore = () => {
    useUiStore.setState({
      filters: { ...initialFilters },
      viewMode: "kanban",
      selectedDealIds: [],
      highlightedDealId: undefined,
      previewDealId: undefined,
      notifications: [],
      dealUpdates: {},
      dismissedHints: new Set<string>(),
    });
  };

  return { ...actual, useUiStore, __resetMockUiStore: resetStore };
});

import { apiClient } from "@/lib/api/client";
import * as apiHooks from "@/lib/api/hooks";
import { dealQueryOptions, dealsQueryOptions } from "@/lib/api/queries";
import { dealsMock } from "@/mocks/data";
import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { useUiStore } from "@/stores/uiStore";
import { Deal, DealStage } from "@/types/crm";
import { createTestQueryClient, renderWithQueryClient } from "@/test-utils";

let resetMockUiStore: (() => void) | undefined;

beforeAll(async () => {
  const module = (await import("@/stores/uiStore")) as { __resetMockUiStore?: () => void };
  resetMockUiStore = module.__resetMockUiStore;
});

beforeEach(() => {
  act(() => {
    resetMockUiStore?.();
  });
  dndHandlers.onDragStart = undefined;
  dndHandlers.onDragEnd = undefined;
  dndHandlers.onDragCancel = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DealFunnelBoard", () => {
  it("отображает сделки по стадиям", async () => {
    const client = createTestQueryClient();
    client.setQueryData(dealsQueryOptions().queryKey, dealsMock);

    renderWithQueryClient(<DealFunnelBoard />, client);

    expect(await screen.findByText("Квалификация"));
    expect(screen.getByText("Переговоры"));
    expect(screen.getAllByText(/Страховка|ДМС|КАСКО/i).length).toBeGreaterThan(0);
  });

  it("оптимистично обновляет стадию сделки", async () => {
    const originalUseUpdateDealStage = apiHooks.useUpdateDealStage;
    let capturedMutation: ReturnType<typeof originalUseUpdateDealStage> | null = null;
    const useUpdateDealStageSpy = vi
      .spyOn(apiHooks, "useUpdateDealStage")
      .mockImplementation(() => {
        const mutation = originalUseUpdateDealStage();
        capturedMutation = mutation;
        return mutation;
      });

    const currentDeals = dealsMock.map((deal) => ({ ...deal }));
    const dealMap = new Map(currentDeals.map((deal) => [deal.id, deal]));

    vi.spyOn(apiClient, "getDeals").mockImplementation(async () => currentDeals.map((deal) => ({ ...deal })));
    vi.spyOn(apiClient, "getDeal").mockImplementation(async (dealId: string) => {
      const found = dealMap.get(dealId);
      if (!found) {
        throw new Error("deal not found");
      }
      return { ...found };
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
        },
      },
    });
    const defaultDealsKey = dealsQueryOptions().queryKey;
    const activeDealsKey = dealsQueryOptions(useUiStore.getState().filters).queryKey;

    const defaultDeals = currentDeals.map((deal) => ({ ...deal }));
    const activeDeals = currentDeals.map((deal) => ({ ...deal }));
    const initialDealSnapshot = { ...dealMap.get("deal-1")! };

    queryClient.setQueryData(defaultDealsKey, defaultDeals);
    queryClient.setQueryData(activeDealsKey, activeDeals);
    queryClient.setQueryData(dealQueryOptions("deal-1").queryKey, initialDealSnapshot);

    let resolveMutation: ((value: Deal) => void) | undefined;
    const updateSpy = vi
      .spyOn(apiClient, "updateDealStage")
      .mockImplementation(async (dealId: string, _stage: DealStage) => {
        return await new Promise<Deal>((resolve) => {
          resolveMutation = (value) => {
            resolve(value);
          };
        });
      });

    renderWithQueryClient(<DealFunnelBoard />, queryClient);

    const qualificationColumn = await screen.findByRole("region", { name: "Квалификация" });
    const proposalColumn = await screen.findByRole("region", { name: "Коммерческое предложение" });

    expect(within(qualificationColumn).getByText("Корпоративная страховка")).toBeInTheDocument();
    expect(within(proposalColumn).queryByText("Корпоративная страховка")).not.toBeInTheDocument();

    expect(capturedMutation).not.toBeNull();
    expect(typeof dndHandlers.onDragEnd).toBe("function");

    await act(async () => {
      dndHandlers.onDragEnd?.({
        active: {
          id: "deal-1",
          data: { current: { stage: "qualification" } },
        },
        over: { id: "proposal" },
      });
    });

    await waitFor(() => {
      const activeDeals = queryClient.getQueryData<Deal[]>(activeDealsKey);
      expect(activeDeals?.find((deal) => deal.id === "deal-1")?.stage).toBe("proposal");
    });

    await waitFor(() => {
      expect(
        within(screen.getByRole("region", { name: "Коммерческое предложение" })).getByText(
          "Корпоративная страховка",
        ),
      ).toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("region", { name: "Квалификация" })).queryByText("Корпоративная страховка"),
    ).not.toBeInTheDocument();

    const serverDeal: Deal = {
      ...dealMap.get("deal-1")!,
      stage: "proposal",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    act(() => {
      resolveMutation?.(serverDeal);
    });

    dealMap.set("deal-1", { ...serverDeal });
    currentDeals.splice(
      currentDeals.findIndex((deal) => deal.id === "deal-1"),
      1,
      { ...serverDeal },
    );

    await waitFor(() => {
      expect(queryClient.getQueryData<Deal>(["deal", "deal-1"])?.updatedAt).toBe(serverDeal.updatedAt);
    });

    expect(updateSpy).toHaveBeenCalledWith("deal-1", "proposal");
    useUpdateDealStageSpy.mockRestore();
  });

  it("отображает уведомление об ошибке и откатывает стадию при неудачном обновлении", async () => {
    const currentDeals = dealsMock.map((deal) => ({ ...deal }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: Infinity,
        },
      },
    });

    const defaultDealsKey = dealsQueryOptions().queryKey;

    queryClient.setQueryData(defaultDealsKey, currentDeals.map((deal) => ({ ...deal })));
    queryClient.setQueryData(dealQueryOptions("deal-1").queryKey, { ...currentDeals[0] });

    const originalUseUpdateDealStage = apiHooks.useUpdateDealStage;
    let capturedMutation: ReturnType<typeof originalUseUpdateDealStage> | null = null;
    const useUpdateDealStageSpy = vi
      .spyOn(apiHooks, "useUpdateDealStage")
      .mockImplementation(() => {
        const mutation = originalUseUpdateDealStage();
        capturedMutation = mutation;
        return mutation;
      });

    vi.spyOn(apiClient, "getDeals").mockResolvedValue(currentDeals.map((deal) => ({ ...deal })));
    vi.spyOn(apiClient, "getDeal").mockImplementation(async (dealId: string) => {
      const found = currentDeals.find((deal) => deal.id === dealId);
      if (!found) {
        throw new Error("deal not found");
      }
      return { ...found };
    });

    vi.spyOn(apiClient, "updateDealStage").mockRejectedValue(new Error("Ошибка обновления"));

    renderWithQueryClient(<DealFunnelBoard />, queryClient);

    expect(capturedMutation).not.toBeNull();
    expect(typeof dndHandlers.onDragEnd).toBe("function");

    await act(async () => {
      dndHandlers.onDragEnd?.({
        active: {
          id: "deal-1",
          data: { current: { stage: "qualification" } },
        },
        over: { id: "proposal" },
      });
    });

    await waitFor(() => {
      expect(useUiStore.getState().notifications).toHaveLength(1);
    });

    expect(useUiStore.getState().notifications[0]).toMatchObject({
      type: "error",
    });

    await waitFor(() => {
      const deals = queryClient.getQueryData<Deal[]>(defaultDealsKey);
      expect(deals?.find((deal) => deal.id === "deal-1")?.stage).toBe("qualification");
    });

    const qualificationColumn = await screen.findByRole("region", { name: "Квалификация" });
    const proposalColumn = await screen.findByRole("region", { name: "Коммерческое предложение" });
    expect(within(qualificationColumn).getByText("Корпоративная страховка")).toBeInTheDocument();
    expect(within(proposalColumn).queryByText("Корпоративная страховка")).not.toBeInTheDocument();

    expect(
      screen.getByText("Не удалось обновить стадию", { selector: "p, div, span" }),
    ).toBeInTheDocument();

    useUpdateDealStageSpy.mockRestore();
  });
});

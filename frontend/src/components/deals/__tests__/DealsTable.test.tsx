import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";

import { DealsTable } from "@/components/deals/DealsTable";
import { useUiStore } from "@/stores/uiStore";
import type { Deal } from "@/types/crm";

const useDealsMock = vi.fn();

vi.mock("@/lib/api/hooks", () => ({
  useDeals: (...args: unknown[]) => useDealsMock(...args),
}));

vi.mock("@/components/deals/DealPreviewSidebar", () => ({
  DealPreviewSidebar: () => <aside data-testid="deal-preview" />,
}));

const initialState = useUiStore.getState();

beforeEach(() => {
  useDealsMock.mockReset();
  act(() => {
    useUiStore.setState(initialState, true);
  });
});

afterEach(() => {
  act(() => {
    useUiStore.setState(initialState, true);
  });
  vi.useRealTimers();
});

async function renderDealsTable(): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(async () => {
    result = render(<DealsTable />);
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- значение устанавливается в act выше
  return result!;
}

describe("DealsTable", () => {
  it("рендерит таблицу сделок и сортирует по ближайшему обзору", async () => {
    const deals: Deal[] = [
      {
        id: "deal-far",
        name: "Страхование склада",
        clientId: "client-1",
        clientName: "ООО Альфа",
        stage: "negotiation",
        probability: 0.6,
        value: 450000,
        nextReviewAt: "2024-02-15T10:00:00.000Z",
        expectedCloseDate: "2024-03-01T00:00:00.000Z",
        updatedAt: "2024-01-10T08:00:00.000Z",
        owner: "manager-1",
        tasks: [],
        notes: [],
        documents: [],
        payments: [],
        activity: [],
      },
      {
        id: "deal-soon",
        name: "Полис для офиса",
        clientId: "client-2",
        clientName: "ООО Бета",
        stage: "proposal",
        probability: 0.75,
        value: 320000,
        nextReviewAt: "2024-01-20T09:00:00.000Z",
        expectedCloseDate: "2024-01-25T00:00:00.000Z",
        updatedAt: "2024-01-11T09:30:00.000Z",
        owner: "manager-2",
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

    await renderDealsTable();

    const table = screen.getByRole("table");
    await screen.findByText("Полис для офиса");
    const headerRow = within(table).getByRole("row", { name: /сделка/i });
    expect(headerRow).toBeInTheDocument();

    const dataRows = Array.from(table.querySelectorAll("tbody tr"));
    expect(dataRows).toHaveLength(2);
    expect(within(dataRows[0]).getByText("Полис для офиса")).toBeInTheDocument();
    expect(within(dataRows[1]).getByText("Страхование склада")).toBeInTheDocument();
  });

  it("показывает состояние загрузки", async () => {
    useDealsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    await renderDealsTable();

    expect(screen.getByText("Загружаем сделки…")).toBeInTheDocument();
    expect(screen.getByTestId("deal-preview")).toBeInTheDocument();
  });

  it("показывает ошибку и даёт повторить запрос", async () => {
    const refetch = vi.fn();
    useDealsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Boom"),
      isFetching: false,
      refetch,
    });

    await renderDealsTable();

    expect(screen.getByText("Не удалось загрузить сделки")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("сбрасывает фильтры при пустой выдаче", async () => {
    act(() => {
      useUiStore.setState((state) => ({
        filters: { ...state.filters, stage: "proposal" },
      }));
    });

    useDealsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    await renderDealsTable();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    });

    expect(useUiStore.getState().filters).toEqual({ stage: "all", managers: [], period: "30d", search: "" });
  });

  it("очищает подсветку обновлённых сделок через таймер", async () => {
    vi.useFakeTimers();

    const deals: Deal[] = [
      {
        id: "deal-updated",
        name: "Продление полиса",
        clientId: "client-3",
        clientName: "ООО Гамма",
        stage: "qualification",
        probability: 0.4,
        value: 150000,
        nextReviewAt: "2024-01-22T09:00:00.000Z",
        expectedCloseDate: undefined,
        updatedAt: "2024-01-12T12:00:00.000Z",
        owner: "manager-3",
        tasks: [],
        notes: [],
        documents: [],
        payments: [],
        activity: [],
      },
    ];

    act(() => {
      useUiStore.setState({
        dealUpdates: { "deal-updated": new Date().toISOString() },
      });
    });

    useDealsMock.mockReturnValue({
      data: deals,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    await renderDealsTable();

    expect(useUiStore.getState().dealUpdates["deal-updated"]).toBeDefined();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(useUiStore.getState().dealUpdates["deal-updated"]).toBeUndefined();
  });
});

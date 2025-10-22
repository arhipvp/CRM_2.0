import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useUpdateDealStage } from "../hooks";
import { dealNotesQueryOptions, dealTasksQueryOptions } from "@/lib/api/queries";
import { apiClient } from "@/lib/api/client";
import { dealsMock } from "@/mocks/data";
import type { DealStage } from "@/types/crm";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    updateDealStage: vi.fn(),
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useUpdateDealStage", () => {
  it("не отменяет запросы задач и заметок сделки во время обновления стадии", async () => {
    const deal = dealsMock[0];
    const nextStage: DealStage = deal.stage === "closedWon" ? "closedLost" : "closedWon";
    const dealId = deal.id;
    const tasksKey = dealTasksQueryOptions(dealId).queryKey;
    const notesKey = dealNotesQueryOptions(dealId).queryKey;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const wrapper = createWrapper(queryClient);

    const never = () => new Promise<never>(() => {});
    const pendingTasks = queryClient.fetchQuery({ queryKey: tasksKey, queryFn: never });
    const pendingNotes = queryClient.fetchQuery({ queryKey: notesKey, queryFn: never });

    pendingTasks.catch(() => {});
    pendingNotes.catch(() => {});

    expect(queryClient.getQueryState(tasksKey)?.fetchStatus).toBe("fetching");
    expect(queryClient.getQueryState(notesKey)?.fetchStatus).toBe("fetching");

    const { result } = renderHook(() => useUpdateDealStage(), { wrapper });
    const updateDealStageMock = vi.mocked(apiClient.updateDealStage);
    updateDealStageMock.mockResolvedValue({ ...deal, stage: nextStage });

    await act(async () => {
      await result.current.mutateAsync({ dealId, stage: nextStage });
    });

    expect(queryClient.getQueryState(tasksKey)?.fetchStatus).toBe("fetching");
    expect(queryClient.getQueryState(notesKey)?.fetchStatus).toBe("fetching");

    await queryClient.cancelQueries({ queryKey: tasksKey, exact: true });
    await queryClient.cancelQueries({ queryKey: notesKey, exact: true });
    queryClient.clear();
  });
});

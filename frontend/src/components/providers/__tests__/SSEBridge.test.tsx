import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SSEBridge } from "../SSEBridge";
import { createEventStream } from "@/lib/sse/createEventStream";
import { useUiStore } from "@/stores/uiStore";

vi.mock("@/lib/sse/createEventStream", () => ({
  createEventStream: vi.fn(() => ({
    close: vi.fn(),
  })),
}));

describe("SSEBridge", () => {
  const createEventStreamMock = vi.mocked(createEventStream);
  const initialState = useUiStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState(initialState, true);
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://example.com/api";
    process.env.NEXT_PUBLIC_CRM_SSE_URL = "https://example.com/crm";
    process.env.NEXT_PUBLIC_NOTIFICATIONS_SSE_URL = "https://example.com/notifications";
  });

  it("создаёт два SSE соединения и не пересоздаёт их при повторном рендере", () => {
    const queryClient = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <SSEBridge />
      </QueryClientProvider>,
    );

    expect(createEventStreamMock).toHaveBeenCalledTimes(2);
    expect(createEventStreamMock).toHaveBeenNthCalledWith(
      1,
      "https://example.com/crm",
      expect.objectContaining({ onMessage: expect.any(Function) }),
    );
    expect(createEventStreamMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/notifications",
      expect.objectContaining({ onMessage: expect.any(Function) }),
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <SSEBridge />
      </QueryClientProvider>,
    );

    expect(createEventStreamMock).toHaveBeenCalledTimes(2);
  });

  it("отключает поток после ошибки и не создаёт новую подписку", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const queryClient = new QueryClient();

    try {
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <SSEBridge />
        </QueryClientProvider>,
      );

      const crmHandlers = createEventStreamMock.mock.calls[0]?.[1];
      const crmStreamControl = createEventStreamMock.mock.results[0]?.value as
        | { close: ReturnType<typeof vi.fn> }
        | undefined;

      expect(crmHandlers?.onError).toBeTypeOf("function");
      expect(crmStreamControl?.close).toBeTypeOf("function");

      await act(async () => {
        crmHandlers?.onError?.(new Event("error"));
        await Promise.resolve();
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(crmStreamControl?.close).toHaveBeenCalledTimes(1);

      rerender(
        <QueryClientProvider client={queryClient}>
          <SSEBridge />
        </QueryClientProvider>,
      );

      expect(createEventStreamMock).toHaveBeenCalledTimes(2);
      expect(
        createEventStreamMock.mock.calls.filter((call) => call[0] === "https://example.com/crm"),
      ).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("не инициализирует SSE-потоки в mock-режиме", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "mock";

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SSEBridge />
      </QueryClientProvider>,
    );

    expect(createEventStreamMock).not.toHaveBeenCalled();
  });

  it("учитывает переданный apiBaseUrl и отключает SSE, когда он равен mock", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SSEBridge apiBaseUrl="mock" />
      </QueryClientProvider>,
    );

    expect(createEventStreamMock).not.toHaveBeenCalled();
  });

  it("нормализует deal_id в CRM событиях", () => {
    const queryClient = new QueryClient();
    const highlightDealSpy = vi.spyOn(useUiStore.getState(), "highlightDeal");
    const markDealUpdatedSpy = vi.spyOn(useUiStore.getState(), "markDealUpdated");
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <SSEBridge />
        </QueryClientProvider>,
      );

      const crmHandlers = createEventStreamMock.mock.calls[0]?.[1];
      expect(crmHandlers?.onMessage).toBeTypeOf("function");

      const handleMessage = crmHandlers?.onMessage;
      expect(handleMessage).toBeDefined();

      act(() => {
        handleMessage?.(
          new MessageEvent("message", {
            data: JSON.stringify({
              id: "event-1",
              deal_id: " deal-77 ",
              message: "Updated",
            }),
          }),
        );
      });

      expect(highlightDealSpy).toHaveBeenCalledWith("deal-77");
      expect(markDealUpdatedSpy).toHaveBeenCalledWith("deal-77");
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["deal", "deal-77"] }),
      );
    } finally {
      highlightDealSpy.mockRestore();
      markDealUpdatedSpy.mockRestore();
      invalidateQueriesSpy.mockRestore();
    }
  });

  it("инвалидирует кеш платежей при CRM-событии с типом платежа", async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    try {
      render(
        <QueryClientProvider client={queryClient}>
          <SSEBridge />
        </QueryClientProvider>,
      );

      const crmHandlers = createEventStreamMock.mock.calls[0]?.[1];
      expect(crmHandlers?.onMessage).toBeTypeOf("function");

      const handleMessage = crmHandlers?.onMessage;
      expect(handleMessage).toBeDefined();

      await act(async () => {
        handleMessage?.(
          new MessageEvent("message", {
            data: JSON.stringify({
              id: "event-1",
              type: "payments.payment.created",
              message: "Создан новый платёж",
            }),
          }),
        );

        await Promise.resolve();
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["payments"] }),
      );
    } finally {
      invalidateQueriesSpy.mockRestore();
    }
  });
});

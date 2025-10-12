import { render } from "@testing-library/react";
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
    process.env.NEXT_PUBLIC_CRM_SSE_URL = "https://example.com/crm";
    process.env.NEXT_PUBLIC_NOTIFICATIONS_SSE_URL = "https://example.com/notifications";
    process.env.NEXT_PUBLIC_PAYMENTS_SSE_URL = "https://example.com/payments";
  });

  it("создаёт три SSE соединения и не пересоздаёт их при повторном рендере", () => {
    const queryClient = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <SSEBridge />
      </QueryClientProvider>,
    );

    expect(createEventStreamMock).toHaveBeenCalledTimes(3);
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
    expect(createEventStreamMock).toHaveBeenNthCalledWith(
      3,
      "https://example.com/payments",
      expect.objectContaining({ onMessage: expect.any(Function) }),
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <SSEBridge />
      </QueryClientProvider>,
    );

    expect(createEventStreamMock).toHaveBeenCalledTimes(3);
  });
});

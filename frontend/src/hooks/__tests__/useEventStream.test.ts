import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEventStream } from "@/hooks/useEventStream";
import { createEventStream } from "@/lib/sse/createEventStream";

vi.mock("@/lib/sse/createEventStream", () => ({
  createEventStream: vi.fn(() => ({
    close: vi.fn(),
  })),
}));

describe("useEventStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("не пересоздает соединение при повторном рендере с теми же обработчиками", () => {
    const createEventStreamMock = vi.mocked(createEventStream);
    const url = "https://example.com/sse";
    const onMessage = vi.fn();
    const onError = vi.fn();

    const { rerender, unmount } = renderHook(
      ({ handlers }: { handlers: Parameters<typeof useEventStream>[1] }) =>
        useEventStream(url, handlers),
      {
        initialProps: {
          handlers: {
            onMessage,
            onError,
          },
        },
      },
    );

    expect(createEventStreamMock).toHaveBeenCalledTimes(1);

    rerender({
      handlers: {
        onMessage,
        onError,
      },
    });

    expect(createEventStreamMock).toHaveBeenCalledTimes(1);

    unmount();

    const closeMock = createEventStreamMock.mock.results[0]?.value?.close;
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});

"use client";

import { useEffect, useMemo } from "react";
import { createEventStream, EventStreamOptions } from "@/lib/sse/createEventStream";

export function useEventStream(
  url: string | undefined,
  handlers: Required<Pick<EventStreamOptions, "onMessage">> & Partial<Omit<EventStreamOptions, "onMessage">>,
) {
  const { onMessage, onError, onOpen, retryInterval, withCredentials, maxRetryInterval } = handlers;

  const stableHandlers = useMemo(
    () => handlers,
    [onMessage, onError, onOpen, retryInterval, withCredentials, maxRetryInterval],
  );

  useEffect(() => {
    const control = createEventStream(url, stableHandlers);
    return () => {
      control?.close();
    };
  }, [url, stableHandlers]);
}

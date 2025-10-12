"use client";

import { useEffect } from "react";
import { createEventStream, EventStreamOptions } from "@/lib/sse/createEventStream";

export function useEventStream(
  url: string | undefined,
  handlers: Required<Pick<EventStreamOptions, "onMessage">> & Partial<Omit<EventStreamOptions, "onMessage">>,
) {
  useEffect(() => {
    const control = createEventStream(url, handlers);
    return () => {
      control?.close();
    };
  }, [url, handlers]);
}

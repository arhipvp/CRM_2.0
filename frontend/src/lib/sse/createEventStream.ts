"use client";

export type EventStreamHandlers = {
  onMessage?: (event: MessageEvent<string>) => void;
  onError?: (event: Event) => void;
  onOpen?: (event: Event) => void;
};

export interface EventStreamOptions extends EventStreamHandlers {
  retryInterval?: number;
  withCredentials?: boolean;
  maxRetryInterval?: number;
}

export interface EventStreamControl {
  close: () => void;
}

const defaultRetry = 5000;
const maxRetry = 30000;

export function createEventStream(url: string | undefined, options: EventStreamOptions = {}): EventStreamControl | undefined {
  if (!url) {
    return undefined;
  }

  let disposed = false;
  let retryDelay = options.retryInterval ?? defaultRetry;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let eventSource: EventSource | undefined;

  const scheduleReconnect = () => {
    if (disposed) {
      return;
    }

    const cappedDelay = Math.min(retryDelay, options.maxRetryInterval ?? maxRetry);
    reconnectTimer = setTimeout(() => {
      retryDelay = Math.min(cappedDelay * 2, options.maxRetryInterval ?? maxRetry);
      connect();
    }, cappedDelay);
  };

  const connect = () => {
    if (disposed) {
      return;
    }

    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(url, {
      withCredentials: options.withCredentials,
    });

    eventSource.onopen = (event) => {
      retryDelay = options.retryInterval ?? defaultRetry;
      options.onOpen?.(event);
    };

    eventSource.onmessage = (event) => {
      options.onMessage?.(event);
    };

    eventSource.onerror = (event) => {
      options.onError?.(event);
      eventSource?.close();
      scheduleReconnect();
    };
  };

  connect();

  return {
    close: () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      eventSource?.close();
    },
  };
}

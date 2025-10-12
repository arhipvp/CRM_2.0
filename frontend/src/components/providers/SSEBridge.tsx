"use client";

import { useCallback, useMemo } from "react";
import { useEventStream } from "@/hooks/useEventStream";
import { useUiStore } from "@/stores/uiStore";

interface CrmEventPayload {
  id?: string;
  message?: string;
  dealId?: string;
  type?: string;
  level?: "info" | "success" | "warning" | "error";
}

interface NotificationPayload extends CrmEventPayload {
  title?: string;
}

function nextId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function parsePayload(event: MessageEvent<string>): CrmEventPayload {
  try {
    return JSON.parse(event.data) as CrmEventPayload;
  } catch (error) {
    console.warn("Не удалось распарсить SSE сообщение", error);
    return { id: nextId(), message: event.data };
  }
}

export function SSEBridge() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const highlightDeal = useUiStore((state) => state.highlightDeal);

  const handleCrmMessage = useCallback(
    (event: MessageEvent<string>) => {
      const payload = parsePayload(event);
      const id = payload.id ?? nextId();

      if (payload.dealId) {
        highlightDeal(payload.dealId);
        setTimeout(() => highlightDeal(undefined), 3000);
      }

      if (payload.message) {
        pushNotification({
          id,
          message: payload.message,
          type: payload.level ?? "info",
          timestamp: new Date().toISOString(),
          source: "crm",
        });
      }
    },
    [highlightDeal, pushNotification],
  );

  const handleCrmError = useCallback((event: Event) => {
    console.error("CRM SSE error", event);
  }, []);

  const handleNotificationMessage = useCallback(
    (event: MessageEvent<string>) => {
      const payload = parsePayload(event) as NotificationPayload;
      pushNotification({
        id: payload.id ?? nextId(),
        message: payload.message ?? payload.title ?? "Новое уведомление",
        type: payload.level ?? "info",
        timestamp: new Date().toISOString(),
        source: "notifications",
      });
    },
    [pushNotification],
  );

  const handleNotificationsError = useCallback((event: Event) => {
    console.error("Notifications SSE error", event);
  }, []);

  const crmHandlers = useMemo(
    () => ({
      onMessage: handleCrmMessage,
      onError: handleCrmError,
    }),
    [handleCrmMessage, handleCrmError],
  );

  const notificationHandlers = useMemo(
    () => ({
      onMessage: handleNotificationMessage,
      onError: handleNotificationsError,
    }),
    [handleNotificationMessage, handleNotificationsError],
  );

  useEventStream(process.env.NEXT_PUBLIC_CRM_SSE_URL, crmHandlers);

  useEventStream(process.env.NEXT_PUBLIC_NOTIFICATIONS_SSE_URL, notificationHandlers);

  return null;
}

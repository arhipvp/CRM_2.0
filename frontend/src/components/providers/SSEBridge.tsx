"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventStream } from "@/hooks/useEventStream";
import { dealQueryOptions, dealsQueryOptions, paymentsQueryOptions } from "@/lib/api/queries";
import { createRandomId } from "@/lib/utils/id";
import { PaymentEventPayload, useUiStore } from "@/stores/uiStore";

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

function parsePayload(event: MessageEvent<string>): CrmEventPayload {
  try {
    return JSON.parse(event.data) as CrmEventPayload;
  } catch (error) {
    console.warn("Не удалось распарсить SSE сообщение", error);
    return { id: createRandomId(), message: event.data };
  }
}

function parsePaymentPayload(event: MessageEvent<string>): PaymentEventPayload {
  const sseEvent = event.type !== "message" ? event.type : undefined;

  try {
    const parsed = JSON.parse(event.data) as PaymentEventPayload;
    return {
      ...parsed,
      event: parsed.event ?? sseEvent,
    };
  } catch (error) {
    console.warn("Не удалось распарсить SSE сообщение платежей", error);
    return {
      id: createRandomId(),
      message: event.data,
      event: sseEvent,
    };
  }
}

const paymentsQueryKey = paymentsQueryOptions().queryKey;
const dealsQueryKey = dealsQueryOptions().queryKey;

export function SSEBridge() {
  const pushNotification = useUiStore((state) => state.pushNotification);
  const highlightDeal = useUiStore((state) => state.highlightDeal);
  const handlePaymentEvent = useUiStore((state) => state.handlePaymentEvent);
  const markDealUpdated = useUiStore((state) => state.markDealUpdated);
  const queryClient = useQueryClient();

  const handleCrmMessage = useCallback(
    (event: MessageEvent<string>) => {
      const payload = parsePayload(event);
      const id = payload.id ?? createRandomId();

      if (payload.dealId) {
        highlightDeal(payload.dealId);
        markDealUpdated(payload.dealId);
        setTimeout(() => highlightDeal(undefined), 3000);
        queryClient.invalidateQueries({ queryKey: dealsQueryKey });
        queryClient.invalidateQueries({ queryKey: dealQueryOptions(payload.dealId).queryKey });
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
    [highlightDeal, markDealUpdated, pushNotification, queryClient],
  );

  const handleCrmError = useCallback((event: Event) => {
    console.error("CRM SSE error", event);
  }, []);

  const handleNotificationMessage = useCallback(
    (event: MessageEvent<string>) => {
      const payload = parsePayload(event) as NotificationPayload;
      pushNotification({
        id: payload.id ?? createRandomId(),
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

  const handlePaymentsMessage = useCallback(
    (event: MessageEvent<string>) => {
      const payload = parsePaymentPayload(event);
      const effect = handlePaymentEvent(payload);

      if (effect.highlightDealId) {
        highlightDeal(effect.highlightDealId);
        markDealUpdated(effect.highlightDealId);
        setTimeout(() => highlightDeal(undefined), 3000);
        queryClient.invalidateQueries({ queryKey: dealQueryOptions(effect.highlightDealId).queryKey });
      }

      if (effect.shouldRefetch) {
        queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
      }
    },
    [handlePaymentEvent, highlightDeal, markDealUpdated, queryClient],
  );

  const handlePaymentsError = useCallback((event: Event) => {
    console.error("Payments SSE error", event);
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

  const paymentsHandlers = useMemo(
    () => ({
      onMessage: handlePaymentsMessage,
      onError: handlePaymentsError,
    }),
    [handlePaymentsMessage, handlePaymentsError],
  );

  useEventStream(process.env.NEXT_PUBLIC_CRM_SSE_URL, crmHandlers);

  useEventStream(process.env.NEXT_PUBLIC_NOTIFICATIONS_SSE_URL, notificationHandlers);

  useEventStream(process.env.NEXT_PUBLIC_PAYMENTS_SSE_URL, paymentsHandlers);

  return null;
}

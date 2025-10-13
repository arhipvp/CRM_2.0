"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventStream } from "@/hooks/useEventStream";
import {
  dealQueryOptions,
  dealStageMetricsQueryOptions,
  paymentsQueryOptions,
} from "@/lib/api/queries";
import { createRandomId } from "@/lib/utils/id";
import { PaymentEventPayload, useUiStore } from "@/stores/uiStore";

type StreamHandlers = Parameters<typeof useEventStream>[1];

interface StreamSubscriptionProps {
  url: string;
  handlers: StreamHandlers;
}

function StreamSubscription({ url, handlers }: StreamSubscriptionProps) {
  useEventStream(url, handlers);
  return null;
}

export interface SSEBridgeProps {
  apiBaseUrl?: string | null;
  crmSseUrl?: string | null;
  notificationsSseUrl?: string | null;
  paymentsSseUrl?: string | null;
}

function normalizeUrl(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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

const dealsQueryKey = ["deals"] as const;
const paymentsQueryKey = paymentsQueryOptions().queryKey;

export function SSEBridge({
  apiBaseUrl,
  crmSseUrl,
  notificationsSseUrl,
  paymentsSseUrl,
}: SSEBridgeProps = {}) {
  const resolvedBaseUrl = (apiBaseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL)?.trim();
  const mockModeEnabled = !resolvedBaseUrl || resolvedBaseUrl === "mock";

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
        queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryOptions().queryKey });
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

  if (mockModeEnabled) {
    return null;
  }

  const crmStreamUrl = normalizeUrl(crmSseUrl ?? process.env.NEXT_PUBLIC_CRM_SSE_URL);
  const notificationsStreamUrl = normalizeUrl(
    notificationsSseUrl ?? process.env.NEXT_PUBLIC_NOTIFICATIONS_SSE_URL,
  );
  const paymentsStreamUrl = normalizeUrl(paymentsSseUrl ?? process.env.NEXT_PUBLIC_PAYMENTS_SSE_URL);

  return (
    <>
      {crmStreamUrl ? <StreamSubscription url={crmStreamUrl} handlers={crmHandlers} /> : null}
      {notificationsStreamUrl ? (
        <StreamSubscription url={notificationsStreamUrl} handlers={notificationHandlers} />
      ) : null}
      {paymentsStreamUrl ? (
        <StreamSubscription url={paymentsStreamUrl} handlers={paymentsHandlers} />
      ) : null}
    </>
  );
}

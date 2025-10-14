"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventStream } from "@/hooks/useEventStream";
import {
  dealQueryOptions,
  dealStageMetricsQueryKey,
  dealsQueryKey,
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
  deal_id?: string;
  type?: string;
  level?: "info" | "success" | "warning" | "error";
}

interface NotificationPayload extends CrmEventPayload {
  title?: string;
}

function parsePayload(event: MessageEvent<string>): CrmEventPayload {
  try {
    const parsed = JSON.parse(event.data) as CrmEventPayload & {
      deal_id?: string | null;
    };

    if (parsed && typeof parsed === "object") {
      const normalizedDealId = [parsed.dealId, parsed.deal_id]
        .map((value) => {
          if (value === null || value === undefined) {
            return undefined;
          }

          const asString = typeof value === "string" ? value : String(value);
          const trimmed = asString.trim();
          return trimmed.length > 0 ? trimmed : undefined;
        })
        .find((value): value is string => Boolean(value));

      return {
        ...parsed,
        dealId: normalizedDealId,
      };
    }

    return parsed;
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

  const [crmStreamEnabled, setCrmStreamEnabled] = useState(true);
  const [notificationsStreamEnabled, setNotificationsStreamEnabled] = useState(true);
  const [paymentsStreamEnabled, setPaymentsStreamEnabled] = useState(true);

  const invalidateDealQueries = useCallback(
    (dealId: string) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
        queryClient.invalidateQueries({
          queryKey: dealQueryOptions(dealId).queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey }),
      ]),
    [queryClient],
  );

  const handleCrmMessage = useCallback(
    (event: MessageEvent<string>) => {
      const payload = parsePayload(event);
      const id = payload.id ?? createRandomId();
      const dealId = payload.dealId;

      if (dealId) {
        highlightDeal(dealId);
        markDealUpdated(dealId);
        setTimeout(() => highlightDeal(undefined), 3000);
        void invalidateDealQueries(dealId);
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
    [highlightDeal, invalidateDealQueries, markDealUpdated, pushNotification],
  );

  const handleCrmError = useCallback((event: Event) => {
    setCrmStreamEnabled((prev) => {
      if (!prev) {
        return prev;
      }

      console.warn(
        "CRM SSE error: поток отключён до перезагрузки страницы. Перезагрузите вкладку, чтобы попробовать снова.",
        event,
      );
      return false;
    });
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
    setNotificationsStreamEnabled((prev) => {
      if (!prev) {
        return prev;
      }

      console.warn(
        "Notifications SSE error: поток отключён до перезагрузки страницы. Перезагрузите вкладку, чтобы восстановить обновления.",
        event,
      );
      return false;
    });
  }, []);

  const handlePaymentsMessage = useCallback(
    (event: MessageEvent<string>) => {
      const payload = parsePaymentPayload(event);
      const effect = handlePaymentEvent(payload);

      if (effect.highlightDealId) {
        highlightDeal(effect.highlightDealId);
        markDealUpdated(effect.highlightDealId);
        setTimeout(() => highlightDeal(undefined), 3000);
      }

      if (effect.shouldRefetch) {
        if (effect.highlightDealId) {
          void invalidateDealQueries(effect.highlightDealId);
        } else {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
            queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey }),
          ]);
        }

        queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
      }
    },
    [
      handlePaymentEvent,
      highlightDeal,
      invalidateDealQueries,
      markDealUpdated,
      queryClient,
    ],
  );

  const handlePaymentsError = useCallback((event: Event) => {
    setPaymentsStreamEnabled((prev) => {
      if (!prev) {
        return prev;
      }

      console.warn(
        "Payments SSE error: поток отключён до перезагрузки страницы. Обновите страницу, чтобы возобновить соединение.",
        event,
      );
      return false;
    });
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

  const shouldRenderCrmStream = Boolean(crmStreamUrl) && crmStreamEnabled;
  const shouldRenderNotificationsStream = Boolean(notificationsStreamUrl) && notificationsStreamEnabled;
  const shouldRenderPaymentsStream = Boolean(paymentsStreamUrl) && paymentsStreamEnabled;

  return (
    <>
      {shouldRenderCrmStream ? <StreamSubscription url={crmStreamUrl!} handlers={crmHandlers} /> : null}
      {shouldRenderNotificationsStream ? (
        <StreamSubscription url={notificationsStreamUrl!} handlers={notificationHandlers} />
      ) : null}
      {shouldRenderPaymentsStream ? (
        <StreamSubscription url={paymentsStreamUrl!} handlers={paymentsHandlers} />
      ) : null}
    </>
  );
}

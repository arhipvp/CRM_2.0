"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventStream } from "@/hooks/useEventStream";
import {
  dealDetailsQueryOptions,
  dealStageMetricsQueryKey,
  dealsQueryKey,
  paymentsQueryOptions,
} from "@/lib/api/queries";
import { createRandomId } from "@/lib/utils/id";
import { useUiStore } from "@/stores/uiStore";

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

const paymentsQueryKey = paymentsQueryOptions().queryKey;
const paymentsWithDetailsKey = paymentsQueryOptions({ include: ["incomes", "expenses"] }).queryKey;

export function SSEBridge({
  apiBaseUrl,
  crmSseUrl,
  notificationsSseUrl,
}: SSEBridgeProps = {}) {
  const resolvedBaseUrl = (apiBaseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL)?.trim();
  const mockModeEnabled = !resolvedBaseUrl || resolvedBaseUrl === "mock";

  const pushNotification = useUiStore((state) => state.pushNotification);
  const highlightDeal = useUiStore((state) => state.highlightDeal);
  const markDealUpdated = useUiStore((state) => state.markDealUpdated);
  const queryClient = useQueryClient();

  const [crmStreamEnabled, setCrmStreamEnabled] = useState(true);
  const [notificationsStreamEnabled, setNotificationsStreamEnabled] = useState(true);

  const invalidateDealQueries = useCallback(
    (dealId: string) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
        queryClient.invalidateQueries({
          queryKey: dealDetailsQueryOptions(dealId).queryKey,
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

      const normalizedType = payload.type?.trim().toLowerCase();
      const normalizedMessage = payload.message?.trim().toLowerCase();
      const shouldInvalidatePayments = Boolean(
        normalizedType?.includes("payment") || normalizedMessage?.includes("платеж"),
      );

      if (shouldInvalidatePayments) {
        if (!dealId) {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
            queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey }),
          ]);
        }

        queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
        queryClient.invalidateQueries({ queryKey: paymentsWithDetailsKey });
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
    [highlightDeal, invalidateDealQueries, markDealUpdated, pushNotification, queryClient],
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

  if (mockModeEnabled) {
    return null;
  }

  const crmStreamUrl = normalizeUrl(crmSseUrl ?? process.env.NEXT_PUBLIC_CRM_SSE_URL);
  const notificationsStreamUrl = normalizeUrl(
    notificationsSseUrl ?? process.env.NEXT_PUBLIC_NOTIFICATIONS_SSE_URL,
  );

  const shouldRenderCrmStream = Boolean(crmStreamUrl) && crmStreamEnabled;
  const shouldRenderNotificationsStream = Boolean(notificationsStreamUrl) && notificationsStreamEnabled;

  return (
    <>
      {shouldRenderCrmStream ? <StreamSubscription url={crmStreamUrl!} handlers={crmHandlers} /> : null}
      {shouldRenderNotificationsStream ? (
        <StreamSubscription url={notificationsStreamUrl!} handlers={notificationHandlers} />
      ) : null}
    </>
  );
}

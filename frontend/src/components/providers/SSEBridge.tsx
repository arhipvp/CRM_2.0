"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventStream } from "@/hooks/useEventStream";
import {
  dealDetailsQueryOptions,
  dealStageMetricsQueryKey,
  dealsQueryKey,
  paymentsQueryOptions,
  notificationsFeedQueryKey,
} from "@/lib/api/queries";
import { createRandomId } from "@/lib/utils/id";
import { useUiStore } from "@/stores/uiStore";
import { useNotificationsStore } from "@/stores/notificationsStore";
import type { NotificationChannel, NotificationFeedItem, NotificationFeedResponse } from "@/types/notifications";

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

function normalizeNotificationSource(value?: string): NotificationFeedItem["source"] {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "crm":
    case "deals":
      return "crm";
    case "payments":
    case "payment":
      return "payments";
    default:
      return "system";
  }
}

function normalizeNotificationCategory(value?: string): NotificationFeedItem["category"] {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "deal":
    case "crm":
    case "sales":
      return "deal";
    case "task":
    case "tasks":
      return "task";
    case "payment":
    case "payments":
      return "payment";
    case "security":
    case "access":
      return "security";
    default:
      return "system";
  }
}

function normalizeNotificationChannels(value?: string | string[]): NotificationFeedItem["channels"] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const channels = new Set<NotificationChannel>();

  for (const channel of raw) {
    const normalized = channel.trim().toLowerCase();
    if (normalized === "telegram") {
      channels.add("telegram");
    }

    if (["sse", "web", "browser", "inbox"].includes(normalized)) {
      channels.add("sse");
    }
  }

  if (channels.size === 0) {
    channels.add("sse");
  }

  return Array.from(channels);
}

function normalizeNotificationContext(
  context: Pick<NotificationFeedItem, "context">["context"] & {
    dealId?: string;
    clientId?: string;
    link?: { href?: string; label?: string };
  },
): NotificationFeedItem["context"] | undefined {
  const dealId = context.dealId?.trim();
  const clientId = context.clientId?.trim();
  const href = context.link?.href?.trim();

  if (!dealId && !clientId && !href) {
    return undefined;
  }

  return {
    dealId: dealId || undefined,
    clientId: clientId || undefined,
    link: href
      ? {
          href,
          label: context.link?.label,
        }
      : undefined,
  };
}

function normalizeDeliveryStatus(value?: string): NotificationFeedItem["deliveryStatus"] {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "failed":
    case "error":
    case "undelivered":
      return "failed";
    case "pending":
    case "retry":
      return "pending";
    default:
      return "delivered";
  }
}

interface CrmEventPayload {
  id?: string;
  message?: string;
  dealId?: string;
  deal_id?: string;
  clientId?: string;
  client_id?: string;
  type?: string;
  level?: "info" | "success" | "warning" | "error";
}

interface NotificationPayload extends CrmEventPayload {
  title?: string;
  category?: string;
  source?: string;
  channels?: string | string[];
  important?: boolean;
  read?: boolean;
  createdAt?: string;
  created_at?: string;
  tags?: string[];
  deliveryStatus?: string;
  delivery_status?: string;
  link?: {
    href?: string;
    label?: string;
  };
}

function parsePayload(event: MessageEvent<string>): CrmEventPayload {
  try {
    const parsed = JSON.parse(event.data) as CrmEventPayload & {
      deal_id?: string | null;
      client_id?: string | null;
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
        clientId:
          parsed.clientId ??
          (typeof parsed.client_id === "string" && parsed.client_id.trim().length > 0
            ? parsed.client_id.trim()
            : undefined),
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
  const ingestNotification = useNotificationsStore((state) => state.ingestNotification);

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
      const now = new Date().toISOString();
      const id = payload.id ?? createRandomId();

      const notification: NotificationFeedItem = {
        id,
        title: payload.title ?? payload.message ?? "Новое уведомление",
        message: payload.message ?? payload.title ?? "",
        createdAt: payload.createdAt ?? payload.created_at ?? now,
        source: normalizeNotificationSource(payload.source),
        category: normalizeNotificationCategory(payload.category),
        tags: payload.tags?.filter(Boolean),
        context: normalizeNotificationContext({
          dealId: payload.dealId,
          clientId: payload.clientId,
          link: payload.link,
        }),
        channels: normalizeNotificationChannels(payload.channels),
        deliveryStatus: normalizeDeliveryStatus(payload.deliveryStatus ?? payload.delivery_status),
        read: Boolean(payload.read),
        important: Boolean(payload.important),
      };

      ingestNotification(notification);
      queryClient.setQueriesData({ queryKey: notificationsFeedQueryKey }, (data: NotificationFeedResponse | undefined) => {
        if (!data) {
          return data;
        }

        const exists = data.items.some((item) => item.id === notification.id);
        const items = exists
          ? data.items.map((item) => (item.id === notification.id ? notification : item))
          : [notification, ...data.items];
        const unreadCount = items.filter((item) => !item.read).length;

        return {
          ...data,
          items,
          unreadCount,
        } satisfies NotificationFeedResponse;
      });

      pushNotification({
        id,
        message: payload.message ?? payload.title ?? "Новое уведомление",
        type: payload.level ?? "info",
        timestamp: now,
        source: "notifications",
      });
    },
    [ingestNotification, pushNotification, queryClient],
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

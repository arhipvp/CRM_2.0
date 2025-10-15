import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { DealFilters } from "@/types/crm";
import { NO_MANAGER_VALUE, getManagerLabel } from "@/lib/utils/managers";
import type {
  NotificationEventJournalFilters,
  NotificationFeedFilters,
} from "@/types/notifications";

const emptyObject = {} as const;

export const dealsQueryKey = ["deals"] as const;
export const dealStageMetricsQueryKey = ["deal-stage-metrics"] as const;
export const notificationsFeedQueryKey = ["notifications", "feed"] as const;
export const notificationsJournalQueryKey = ["notifications", "journal"] as const;

function sanitizeDealFilters(filters?: DealFilters): DealFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const sanitized: DealFilters = {};

  if (filters.stage && filters.stage !== "all") {
    sanitized.stage = filters.stage;
  }

  if (filters.managers && filters.managers.length > 0) {
    const unique = Array.from(
      new Set(
        filters.managers
          .map((manager) => (manager === NO_MANAGER_VALUE ? NO_MANAGER_VALUE : manager.trim()))
          .filter((manager) => manager === NO_MANAGER_VALUE || manager.length > 0),
      ),
    );
    unique.sort((a, b) => getManagerLabel(a).localeCompare(getManagerLabel(b)));
    if (unique.length > 0) {
      sanitized.managers = unique;
    }
  }

  if (filters.period && filters.period !== "all") {
    sanitized.period = filters.period;
  }

  if (filters.search && filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export const dealsQueryOptions = (filters?: DealFilters) => {
  const sanitizedFilters = sanitizeDealFilters(filters);

  return queryOptions({
    queryKey: [...dealsQueryKey, sanitizedFilters ?? emptyObject] as const,
    queryFn: () => apiClient.getDeals(sanitizedFilters),
  });
};

export const dealStageMetricsQueryOptions = (filters?: DealFilters) => {
  const sanitizedFilters = sanitizeDealFilters(filters);

  return queryOptions({
    queryKey: [...dealStageMetricsQueryKey, sanitizedFilters ?? emptyObject] as const,
    queryFn: () => apiClient.getDealStageMetrics(sanitizedFilters),
  });
};

export const dealDetailsQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId, "details"],
    queryFn: () => apiClient.getDealDetails(dealId),
    enabled: Boolean(dealId),
  });

export const dealTasksQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId, "tasks"],
    queryFn: () => apiClient.getDealTasks(dealId),
    enabled: Boolean(dealId),
  });

export const dealNotesQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId, "notes"],
    queryFn: () => apiClient.getDealNotes(dealId),
    enabled: Boolean(dealId),
  });

export const dealDocumentsQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId, "documents"],
    queryFn: () => apiClient.getDealDocuments(dealId),
    enabled: Boolean(dealId),
  });

export const dealPaymentsQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId, "payments"],
    queryFn: () => apiClient.getDealPayments(dealId),
    enabled: Boolean(dealId),
  });

export const dealActivityQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId, "activity"],
    queryFn: () => apiClient.getDealActivity(dealId),
    enabled: Boolean(dealId),
  });

export const clientsQueryOptions = () =>
  queryOptions({
    queryKey: ["clients"],
    queryFn: () => apiClient.getClients(),
  });

export const clientQueryOptions = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId],
    queryFn: () => apiClient.getClient(clientId),
    enabled: Boolean(clientId),
  });

export const clientActivityQueryOptions = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "activity"],
    queryFn: () => apiClient.getClientActivities(clientId),
    enabled: Boolean(clientId),
  });

export const tasksQueryOptions = () =>
  queryOptions({
    queryKey: ["tasks"],
    queryFn: () => apiClient.getTasks(),
  });

export interface PaymentsQueryParams {
  include?: Array<"incomes" | "expenses">;
}

function normalizePaymentsInclude(include?: Array<"incomes" | "expenses">) {
  if (!include || include.length === 0) {
    return undefined;
  }

  const unique = Array.from(new Set(include.filter(Boolean)));
  unique.sort();
  return unique as Array<"incomes" | "expenses">;
}

export const paymentsQueryOptions = (params?: PaymentsQueryParams) => {
  const include = normalizePaymentsInclude(params?.include);

  return queryOptions({
    queryKey: ["payments", include ?? []] as const,
    queryFn: () => apiClient.getPayments({ include }),
  });
};

function sanitizeNotificationFeedFilters(
  filters?: NotificationFeedFilters,
): NotificationFeedFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const sanitized: NotificationFeedFilters = {};

  if (filters.category && filters.category !== "all") {
    sanitized.category = filters.category;
  }

  if (filters.source && filters.source !== "all") {
    sanitized.source = filters.source;
  }

  if (filters.status && filters.status !== "all") {
    sanitized.status = filters.status;
  }

  if (filters.search && filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeNotificationJournalFilters(
  filters?: NotificationEventJournalFilters,
): NotificationEventJournalFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const sanitized: NotificationEventJournalFilters = {};

  if (filters.category && filters.category !== "all") {
    sanitized.category = filters.category;
  }

  if (filters.source && filters.source !== "all") {
    sanitized.source = filters.source;
  }

  if (filters.severity && filters.severity !== "all") {
    sanitized.severity = filters.severity;
  }

  if (filters.search && filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export const notificationsFeedQueryOptions = (filters?: NotificationFeedFilters) => {
  const sanitized = sanitizeNotificationFeedFilters(filters);

  return queryOptions({
    queryKey: [...notificationsFeedQueryKey, sanitized ?? emptyObject] as const,
    queryFn: () => apiClient.getNotificationFeed(sanitized),
  });
};

export const notificationJournalQueryOptions = (filters?: NotificationEventJournalFilters) => {
  const sanitized = sanitizeNotificationJournalFilters(filters);

  return queryOptions({
    queryKey: [...notificationsJournalQueryKey, sanitized ?? emptyObject] as const,
    queryFn: () => apiClient.getNotificationEventJournal(sanitized),
  });
};

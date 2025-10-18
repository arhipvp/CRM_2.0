import { queryOptions } from "@tanstack/react-query";
import {
  apiClient,
  type ApiClient,
  type ClientActivityQueryParams,
  type ClientPoliciesQueryParams,
} from "@/lib/api/client";
import { ActivityLogEntry, DealFilters } from "@/types/crm";
import { NO_MANAGER_VALUE, getManagerLabel } from "@/lib/utils/managers";
import type {
  NotificationEventJournalFilters,
  NotificationFeedFilters,
} from "@/types/notifications";

const emptyObject = {} as const;

export const dealsQueryKey = ["deals"] as const;
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

export const dealsQueryOptions = (filters?: DealFilters, client: ApiClient = apiClient) => {
  const sanitizedFilters = sanitizeDealFilters(filters);

  return queryOptions({
    queryKey: [...dealsQueryKey, sanitizedFilters ?? emptyObject] as const,
    queryFn: () => client.getDeals(sanitizedFilters),
  });
};

export const dealDetailsQueryOptions = (dealId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["deal", dealId, "details"],
    queryFn: () => client.getDealDetails(dealId),
    enabled: Boolean(dealId),
  });

export const dealTasksQueryOptions = (dealId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["deal", dealId, "tasks"],
    queryFn: () => client.getDealTasks(dealId),
    enabled: Boolean(dealId),
  });

export const dealNotesQueryOptions = (dealId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["deal", dealId, "notes"],
    queryFn: () => client.getDealNotes(dealId),
    enabled: Boolean(dealId),
  });

export const dealDocumentsQueryOptions = (dealId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["deal", dealId, "documents"],
    queryFn: () => client.getDealDocuments(dealId),
    enabled: Boolean(dealId),
  });

export const dealPaymentsQueryOptions = (dealId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["deal", dealId, "payments"],
    queryFn: () => client.getDealPayments(dealId),
    enabled: Boolean(dealId),
  });

export const dealActivityQueryOptions = (dealId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["deal", dealId, "activity"],
    queryFn: () => client.getDealActivity(dealId),
    enabled: Boolean(dealId),
  });

export const clientsQueryOptions = (client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["clients"],
    queryFn: () => client.getClients(),
  });

export const clientQueryOptions = (clientId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["client", clientId],
    queryFn: () => client.getClient(clientId),
    enabled: Boolean(clientId),
  });

const clientActivityTypes = new Set<ActivityLogEntry["type"]>(["email", "meeting", "note", "system"]);

function normalizeClientPoliciesParams(params?: ClientPoliciesQueryParams) {
  if (!params) {
    return undefined;
  }

  const normalized: ClientPoliciesQueryParams = {};

  if (params.status && (params.status === "active" || params.status === "archived")) {
    normalized.status = params.status;
  }

  if (params.search && params.search.trim().length > 0) {
    normalized.search = params.search.trim();
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeClientActivityParams(params?: ClientActivityQueryParams) {
  if (!params) {
    return undefined;
  }

  const normalized: ClientActivityQueryParams = {};

  if (params.type && params.type !== "all" && clientActivityTypes.has(params.type)) {
    normalized.type = params.type;
  }

  if (params.page && Number.isFinite(params.page)) {
    const page = Math.max(1, Math.floor(params.page));
    if (page > 1) {
      normalized.page = page;
    }
  }

  if (params.pageSize && Number.isFinite(params.pageSize)) {
    const pageSize = Math.max(1, Math.floor(params.pageSize));
    if (pageSize !== 5) {
      normalized.pageSize = Math.min(50, pageSize);
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export const clientActivityQueryOptions = (
  clientId: string,
  params?: ClientActivityQueryParams,
  client: ApiClient = apiClient,
) => {
  const normalized = normalizeClientActivityParams(params);

  return queryOptions({
    queryKey: ["client", clientId, "activity", normalized ?? emptyObject] as const,
    queryFn: () => client.getClientActivities(clientId, normalized),
    enabled: Boolean(clientId),
  });
};

export const clientPoliciesQueryOptions = (
  clientId: string,
  params?: ClientPoliciesQueryParams,
  client: ApiClient = apiClient,
) => {
  const normalized = normalizeClientPoliciesParams(params);

  return queryOptions({
    queryKey: ["client", clientId, "policies", normalized ?? emptyObject] as const,
    queryFn: () => client.getClientPolicies(clientId, normalized),
    enabled: Boolean(clientId),
  });
};

export const clientTasksChecklistQueryOptions = (clientId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["client", clientId, "tasks", "checklist"],
    queryFn: () => client.getClientTasks(clientId),
    enabled: Boolean(clientId),
  });

export const clientRemindersQueryOptions = (clientId: string, client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["client", clientId, "reminders"],
    queryFn: () => client.getClientReminders(clientId),
    enabled: Boolean(clientId),
  });

export const tasksQueryOptions = (client: ApiClient = apiClient) =>
  queryOptions({
    queryKey: ["tasks"],
    queryFn: () => client.getTasks(),
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

export const paymentsQueryOptions = (params?: PaymentsQueryParams, client: ApiClient = apiClient) => {
  const include = normalizePaymentsInclude(params?.include);

  return queryOptions({
    queryKey: ["payments", include ?? []] as const,
    queryFn: () => client.getPayments({ include }),
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

export const notificationsFeedQueryOptions = (
  filters?: NotificationFeedFilters,
  client: ApiClient = apiClient,
) => {
  const sanitized = sanitizeNotificationFeedFilters(filters);

  return queryOptions({
    queryKey: [...notificationsFeedQueryKey, sanitized ?? emptyObject] as const,
    queryFn: () => client.getNotificationFeed(sanitized),
  });
};

export const notificationJournalQueryOptions = (
  filters?: NotificationEventJournalFilters,
  client: ApiClient = apiClient,
) => {
  const sanitized = sanitizeNotificationJournalFilters(filters);

  return queryOptions({
    queryKey: [...notificationsJournalQueryKey, sanitized ?? emptyObject] as const,
    queryFn: () => client.getNotificationEventJournal(sanitized),
  });
};

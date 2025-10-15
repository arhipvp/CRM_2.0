import { queryOptions } from "@tanstack/react-query";
import { apiClient, type ClientActivityQueryParams, type ClientPoliciesQueryParams } from "@/lib/api/client";
import { ActivityLogEntry, DealFilters } from "@/types/crm";
import { NO_MANAGER_VALUE, getManagerLabel } from "@/lib/utils/managers";

const emptyObject = {} as const;

export const dealsQueryKey = ["deals"] as const;
export const dealStageMetricsQueryKey = ["deal-stage-metrics"] as const;

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

export const clientActivityQueryOptions = (clientId: string, params?: ClientActivityQueryParams) => {
  const normalized = normalizeClientActivityParams(params);

  return queryOptions({
    queryKey: ["client", clientId, "activity", normalized ?? emptyObject] as const,
    queryFn: () => apiClient.getClientActivities(clientId, normalized),
    enabled: Boolean(clientId),
  });
};

export const clientPoliciesQueryOptions = (clientId: string, params?: ClientPoliciesQueryParams) => {
  const normalized = normalizeClientPoliciesParams(params);

  return queryOptions({
    queryKey: ["client", clientId, "policies", normalized ?? emptyObject] as const,
    queryFn: () => apiClient.getClientPolicies(clientId, normalized),
    enabled: Boolean(clientId),
  });
};

export const clientTasksChecklistQueryOptions = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "tasks", "checklist"],
    queryFn: () => apiClient.getClientTasks(clientId),
    enabled: Boolean(clientId),
  });

export const clientRemindersQueryOptions = (clientId: string) =>
  queryOptions({
    queryKey: ["client", clientId, "reminders"],
    queryFn: () => apiClient.getClientReminders(clientId),
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

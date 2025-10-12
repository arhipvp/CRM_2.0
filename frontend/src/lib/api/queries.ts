import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { DealFilters } from "@/types/crm";

const emptyObject = {} as const;

function sanitizeDealFilters(filters?: DealFilters): DealFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const sanitized: DealFilters = {};

  if (filters.stage && filters.stage !== "all") {
    sanitized.stage = filters.stage;
  }

  if (filters.managers && filters.managers.length > 0) {
    const unique = Array.from(new Set(filters.managers.filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
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
    queryKey: ["deals", sanitizedFilters ?? emptyObject],
    queryFn: () => apiClient.getDeals(sanitizedFilters),
  });
};

export const dealQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId],
    queryFn: () => apiClient.getDeal(dealId),
    enabled: Boolean(dealId),
  });

export const dealStageMetricsQueryOptions = (filters?: DealFilters) => {
  const sanitizedFilters = sanitizeDealFilters(filters);

  return queryOptions({
    queryKey: ["deals", "metrics", sanitizedFilters ?? emptyObject],
    queryFn: () => apiClient.getDealStageMetrics(sanitizedFilters),
  });
};

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

export const paymentsQueryOptions = () =>
  queryOptions({
    queryKey: ["payments"],
    queryFn: () => apiClient.getPayments(),
  });

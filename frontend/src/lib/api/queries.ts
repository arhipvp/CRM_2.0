import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export const dealsQueryOptions = () =>
  queryOptions({
    queryKey: ["deals"],
    queryFn: () => apiClient.getDeals(),
  });

export const dealQueryOptions = (dealId: string) =>
  queryOptions({
    queryKey: ["deal", dealId],
    queryFn: () => apiClient.getDeal(dealId),
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

export const paymentsQueryOptions = () =>
  queryOptions({
    queryKey: ["payments"],
    queryFn: () => apiClient.getPayments(),
  });

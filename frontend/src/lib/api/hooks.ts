"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  clientActivityQueryOptions,
  clientQueryOptions,
  clientsQueryOptions,
  dealQueryOptions,
  dealsQueryOptions,
  paymentsQueryOptions,
  tasksQueryOptions,
} from "@/lib/api/queries";

export function useDeals() {
  return useQuery(dealsQueryOptions());
}

export function useDeal(dealId: string) {
  return useQuery(dealQueryOptions(dealId));
}

export function useClients() {
  return useQuery(clientsQueryOptions());
}

export function useClient(clientId: string) {
  return useQuery(clientQueryOptions(clientId));
}

export function useClientActivity(clientId: string) {
  return useQuery(clientActivityQueryOptions(clientId));
}

export function useTasks() {
  return useQuery(tasksQueryOptions());
}

export function useToggleTask() {
  return useMutation({
    mutationKey: ["toggle-task"],
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      apiClient.updateTaskStatus(taskId, completed),
  });
}

export function usePayments() {
  return useQuery(paymentsQueryOptions());
}

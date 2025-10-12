"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  clientActivityQueryOptions,
  clientQueryOptions,
  clientsQueryOptions,
  dealQueryOptions,
  dealsQueryOptions,
  dealStageMetricsQueryOptions,
  paymentsQueryOptions,
  tasksQueryOptions,
} from "@/lib/api/queries";
import { Deal, DealFilters, DealStage } from "@/types/crm";

export function useDeals(filters?: DealFilters) {
  return useQuery(dealsQueryOptions(filters));
}

export function useDeal(dealId: string) {
  return useQuery(dealQueryOptions(dealId));
}

export function useDealStageMetrics(filters?: DealFilters) {
  return useQuery(dealStageMetricsQueryOptions(filters));
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

interface UpdateDealStageVariables {
  dealId: string;
  stage: DealStage;
  optimisticUpdate?: (deal: Deal) => Deal;
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["deal", "update-stage"],
    mutationFn: ({ dealId, stage }: UpdateDealStageVariables) => apiClient.updateDealStage(dealId, stage),
    onMutate: async ({ dealId, stage, optimisticUpdate }) => {
      await queryClient.cancelQueries({ queryKey: ["deals"] });

      const previousDeals = queryClient.getQueriesData<Deal[]>({ queryKey: ["deals"] });

      for (const [queryKey, deals] of previousDeals) {
        if (!deals) {
          continue;
        }

        const updatedDeals = deals.map((deal) => {
          if (deal.id !== dealId) {
            return deal;
          }

          if (optimisticUpdate) {
            return optimisticUpdate({ ...deal });
          }

          return { ...deal, stage, updatedAt: new Date().toISOString() };
        });

        queryClient.setQueryData(queryKey, updatedDeals);
      }

      return { previousDeals };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousDeals) {
        return;
      }

      for (const [queryKey, deals] of context.previousDeals) {
        queryClient.setQueryData(queryKey, deals);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["deals", "metrics"] }),
      ]);
    },
  });
}

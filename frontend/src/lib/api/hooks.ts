"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  dealStageMetricsQueryKey,
  dealActivityQueryOptions,
  clientActivityQueryOptions,
  clientQueryOptions,
  clientsQueryOptions,
  dealsQueryKey,
  dealDocumentsQueryOptions,
  dealDetailsQueryOptions,
  dealTasksQueryOptions,
  dealNotesQueryOptions,
  dealPaymentsQueryOptions,
  dealsQueryOptions,
  dealStageMetricsQueryOptions,
  paymentsQueryOptions,
  tasksQueryOptions,
} from "@/lib/api/queries";
import type { Deal, DealFilters, DealStage } from "@/types/crm";

export function useDeals(filters?: DealFilters) {
  return useQuery(dealsQueryOptions(filters));
}

export function useDealStageMetrics(filters?: DealFilters) {
  return useQuery(dealStageMetricsQueryOptions(filters));
}

export function useDealDetails(dealId: string) {
  return useQuery(dealDetailsQueryOptions(dealId));
}

export function useDealTasks(dealId: string) {
  return useQuery(dealTasksQueryOptions(dealId));
}

export function useDealNotes(dealId: string) {
  return useQuery(dealNotesQueryOptions(dealId));
}

export function useDealDocuments(dealId: string) {
  return useQuery(dealDocumentsQueryOptions(dealId));
}

export function useDealPayments(dealId: string) {
  return useQuery(dealPaymentsQueryOptions(dealId));
}

export function useDealActivity(dealId: string) {
  return useQuery(dealActivityQueryOptions(dealId));
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["toggle-task"],
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      apiClient.updateTaskStatus(taskId, completed),
    onSuccess: async (task) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: tasksQueryOptions().queryKey }),
        queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
        queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey }),
      ];

      if (task.dealId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: dealDetailsQueryOptions(task.dealId).queryKey,
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: dealTasksQueryOptions(task.dealId).queryKey,
          }),
        );
      }

      await Promise.all(invalidations);
    },
  });
}

export function usePayments() {
  return useQuery(paymentsQueryOptions());
}

export function useCreateDealTask(dealId: string) {
  return useMutation({
    mutationKey: ["create-deal-task", dealId],
    mutationFn: apiClient.createDealTask.bind(apiClient, dealId),
  });
}

export function useCreateDealNote(dealId: string) {
  return useMutation({
    mutationKey: ["create-deal-note", dealId],
    mutationFn: apiClient.createDealNote.bind(apiClient, dealId),
  });
}

export function useUploadDealDocument(dealId: string) {
  return useMutation({
    mutationKey: ["upload-deal-document", dealId],
    mutationFn: apiClient.uploadDealDocument.bind(apiClient, dealId),
  });
}

export function useUpdateDeal(dealId: string) {
  return useMutation({
    mutationKey: ["update-deal", dealId],
    mutationFn: apiClient.updateDeal.bind(apiClient, dealId),
  });
}

type UpdateDealStageVariables = {
  dealId: string;
  stage: DealStage;
  optimisticUpdate?: (deal: Deal) => Deal;
};

type UpdateDealStageContext = {
  previousDeals: Array<[QueryKey, Deal[] | Deal | undefined]>;
  previousDeal?: Deal;
};

export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation<Deal, unknown, UpdateDealStageVariables, UpdateDealStageContext>({
    mutationKey: ["update-deal-stage"],
    mutationFn: ({ dealId, stage }) => apiClient.updateDealStage(dealId, stage),
    onMutate: async ({ dealId, optimisticUpdate, stage }) => {
      const singleDealQueryKey = dealDetailsQueryOptions(dealId).queryKey;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: dealsQueryKey }),
        queryClient.cancelQueries({ queryKey: singleDealQueryKey, exact: true }),
      ]);

      const previousDeals = queryClient.getQueriesData<Deal[] | Deal>({
        queryKey: dealsQueryKey,
      });
      const previousDeal = queryClient.getQueryData<Deal>(singleDealQueryKey);

      const applyOptimisticUpdate = (deal: Deal): Deal => {
        if (optimisticUpdate) {
          return optimisticUpdate(deal);
        }

        return { ...deal, stage };
      };

      for (const [queryKey, data] of previousDeals) {
        if (!Array.isArray(data)) {
          continue;
        }

        queryClient.setQueryData<Deal[] | undefined>(queryKey, (currentDeals) => {
          if (!currentDeals) {
            return currentDeals;
          }

          return currentDeals.map((deal) =>
            deal.id === dealId ? applyOptimisticUpdate(deal) : deal,
          );
        });
      }

      if (previousDeal) {
        queryClient.setQueryData<Deal>(
          singleDealQueryKey,
          applyOptimisticUpdate(previousDeal),
        );
      }

      return { previousDeals, previousDeal } satisfies UpdateDealStageContext;
    },
    onError: (_error, { dealId }, context) => {
      if (!context) {
        return;
      }

      for (const [queryKey, data] of context.previousDeals) {
        queryClient.setQueryData(queryKey, data);
      }

      if (context.previousDeal) {
        queryClient.setQueryData(
          dealDetailsQueryOptions(dealId).queryKey,
          context.previousDeal,
        );
      }
    },
    onSuccess: (deal) => {
      for (const [queryKey, data] of queryClient.getQueriesData<Deal[] | Deal>({
        queryKey: dealsQueryKey,
      })) {
        if (!Array.isArray(data)) {
          continue;
        }

        queryClient.setQueryData(queryKey, (currentDeals?: Deal[]) => {
          if (!currentDeals) {
            return currentDeals;
          }

          return currentDeals.map((item) => (item.id === deal.id ? deal : item));
        });
      }

      queryClient.setQueryData(dealDetailsQueryOptions(deal.id).queryKey, deal);
    },
    onSettled: async (_data, _error, variables) => {
      if (!variables) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
        queryClient.invalidateQueries({
          queryKey: dealDetailsQueryOptions(variables.dealId).queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey }),
      ]);
    },
  });
}

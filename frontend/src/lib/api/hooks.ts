"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  dealActivityQueryOptions,
  clientActivityQueryOptions,
  clientQueryOptions,
  clientsQueryOptions,
  dealDocumentsQueryOptions,
  dealQueryOptions,
  dealTasksQueryOptions,
  dealNotesQueryOptions,
  dealPaymentsQueryOptions,
  dealsQueryOptions,
  dealStageMetricsQueryOptions,
  paymentsQueryOptions,
  tasksQueryOptions,
} from "@/lib/api/queries";
import { Deal, DealFilters, DealStage } from "@/types/crm";

export function useDeals(filters?: DealFilters) {
  return useQuery(dealsQueryOptions(filters));
}

export function useDealStageMetrics(filters?: DealFilters) {
  return useQuery(dealStageMetricsQueryOptions(filters));
}

export function useDeal(dealId: string) {
  return useQuery(dealQueryOptions(dealId));
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
  return useMutation({
    mutationKey: ["toggle-task"],
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      apiClient.updateTaskStatus(taskId, completed),
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
  previousDeals: Array<{
    queryKey: readonly unknown[];
    data: Deal[] | undefined;
  }>;
  previousDeal?: Deal;
};

export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation<Deal, unknown, UpdateDealStageVariables, UpdateDealStageContext>({
    mutationKey: ["update-deal-stage"],
    mutationFn: ({ dealId, stage }) => apiClient.updateDeal(dealId, { stage }),
    onMutate: async ({ dealId, optimisticUpdate, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["deals"] });
      await queryClient.cancelQueries({ queryKey: dealQueryOptions(dealId).queryKey });

      const dealsQueries = queryClient.getQueryCache().findAll({ queryKey: ["deals"] });
      const previousDeals = dealsQueries.map((query) => ({
        queryKey: query.queryKey,
        data: query.state.data as Deal[] | undefined,
      }));

      const dealQueryKey = dealQueryOptions(dealId).queryKey;
      const previousDeal = queryClient.getQueryData<Deal>(dealQueryKey);

      const applyOptimisticUpdate = (deal: Deal): Deal => {
        if (optimisticUpdate) {
          return optimisticUpdate(deal);
        }

        return { ...deal, stage };
      };

      for (const query of dealsQueries) {
        queryClient.setQueryData<Deal[]>(query.queryKey, (current) => {
          if (!current) {
            return current;
          }

          return current.map((deal) =>
            deal.id === dealId ? applyOptimisticUpdate(deal) : deal,
          );
        });
      }

      queryClient.setQueryData<Deal | undefined>(dealQueryKey, (current) =>
        current ? applyOptimisticUpdate(current) : current,
      );

      return { previousDeals, previousDeal } satisfies UpdateDealStageContext;
    },
    onError: (_error, { dealId }, context) => {
      if (!context) {
        return;
      }

      for (const { queryKey, data } of context.previousDeals) {
        queryClient.setQueryData(queryKey, data);
      }

      const dealQueryKey = dealQueryOptions(dealId).queryKey;
      queryClient.setQueryData(dealQueryKey, context.previousDeal);
    },
    onSettled: async (_data, _error, { dealId }) => {
      await queryClient.invalidateQueries({ queryKey: ["deals"] });
      await queryClient.invalidateQueries({ queryKey: dealQueryOptions(dealId).queryKey });
    },
  });
}

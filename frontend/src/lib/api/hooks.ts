"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  apiClient,
  type CreateTaskPayload,
  type PaymentConfirmationPayload,
  type PaymentEntryPayload,
  type PaymentPayload,
  type PaymentRevokePayload,
  type PaymentUpdatePayload,
} from "@/lib/api/client";
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
  type PaymentsQueryParams,
  notificationJournalQueryOptions,
  notificationsFeedQueryKey,
  notificationsFeedQueryOptions,
  tasksQueryOptions,
} from "@/lib/api/queries";
import type { Deal, DealFilters, DealStage } from "@/types/crm";
import type {
  NotificationChannel,
  NotificationEventJournalFilters,
  NotificationFeedFilters,
  NotificationFeedItem,
  NotificationFeedResponse,
} from "@/types/notifications";
import { useNotificationsStore } from "@/stores/notificationsStore";

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

function createTaskInvalidations(queryClient: ReturnType<typeof useQueryClient>, task: { dealId?: string }) {
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

  return invalidations;
}

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["toggle-task"],
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      apiClient.updateTask(taskId, { completed }),
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

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["update-task"],
    mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateTaskPayload }) =>
      apiClient.updateTask(taskId, payload),
    onSuccess: async (task) => {
      const invalidations = createTaskInvalidations(queryClient, task);
      await Promise.all(invalidations);
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["create-task"],
    mutationFn: (payload: CreateTaskPayload) => apiClient.createTask(payload),
    onSuccess: async (task) => {
      const invalidations = createTaskInvalidations(queryClient, task);
      await Promise.all(invalidations);
    },
  });
}

export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["bulk-update-tasks"],
    mutationFn: ({
      taskIds,
      payload,
      options,
    }: {
      taskIds: string[];
      payload: UpdateTaskPayload;
      options?: { shiftDueDateByDays?: number };
    }) => apiClient.bulkUpdateTasks(taskIds, payload, options),
    onSuccess: async (tasks) => {
      const invalidations = tasks.flatMap((task) => createTaskInvalidations(queryClient, task));
      await Promise.all(invalidations);
    },
  });
}

export function usePayments(params?: PaymentsQueryParams) {
  return useQuery(paymentsQueryOptions(params));
}

export function useNotificationFeed(filters?: NotificationFeedFilters) {
  return useQuery(notificationsFeedQueryOptions(filters));
}

export function useNotificationEventJournal(filters?: NotificationEventJournalFilters) {
  return useQuery(notificationJournalQueryOptions(filters));
}

function updateFeedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (item: NotificationFeedItem) => NotificationFeedItem,
) {
  queryClient.setQueriesData({ queryKey: notificationsFeedQueryKey }, (data: NotificationFeedResponse | undefined) => {
    if (!data) {
      return data;
    }

    const items = data.items.map((item) => updater(item));
    const unreadCount = items.filter((item) => !item.read).length;

    return {
      ...data,
      items,
      unreadCount,
    } satisfies NotificationFeedResponse;
  });
}

function removeFromFeedQueries(queryClient: ReturnType<typeof useQueryClient>, ids: string[]) {
  queryClient.setQueriesData({ queryKey: notificationsFeedQueryKey }, (data: NotificationFeedResponse | undefined) => {
    if (!data) {
      return data;
    }

    const idSet = new Set(ids);
    const items = data.items.filter((item) => !idSet.has(item.id));
    const unreadCount = items.filter((item) => !item.read).length;

    return {
      ...data,
      items,
      unreadCount,
    } satisfies NotificationFeedResponse;
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const markAsRead = useNotificationsStore((state) => state.markAsRead);

  return useMutation({
    mutationKey: ["notifications", "mark-read"],
    mutationFn: ({ ids }: { ids: string[] }) => apiClient.markNotificationsRead(ids),
    onMutate: async ({ ids }) => {
      const snapshot = ids.map((id) => useNotificationsStore.getState().items[id]).filter(Boolean);
      markAsRead(ids);
      updateFeedQueries(queryClient, (item) => (ids.includes(item.id) ? { ...item, read: true } : item));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        useNotificationsStore.getState().replaceNotifications(context.snapshot);
        updateFeedQueries(queryClient, (item) => {
          const previous = context.snapshot?.find((snapshotItem) => snapshotItem.id === item.id);
          return previous ? { ...item, read: previous.read } : item;
        });
      }
    },
    onSuccess: (updated) => {
      if (updated.length > 0) {
        useNotificationsStore.getState().replaceNotifications(updated);
      }
    },
  });
}

export function useToggleNotificationsImportant() {
  const queryClient = useQueryClient();
  const markImportant = useNotificationsStore((state) => state.markImportant);

  return useMutation({
    mutationKey: ["notifications", "mark-important"],
    mutationFn: ({ ids, important }: { ids: string[]; important: boolean }) =>
      apiClient.toggleNotificationsImportant(ids, important),
    onMutate: async ({ ids, important }) => {
      const snapshot = ids.map((id) => useNotificationsStore.getState().items[id]).filter(Boolean);
      markImportant(ids, important);
      updateFeedQueries(queryClient, (item) => (ids.includes(item.id) ? { ...item, important } : item));
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        useNotificationsStore.getState().replaceNotifications(context.snapshot);
        updateFeedQueries(queryClient, (item) => {
          const previous = context.snapshot?.find((snapshotItem) => snapshotItem.id === item.id);
          return previous ? { ...item, important: previous.important } : item;
        });
      }
    },
    onSuccess: (updated) => {
      if (updated.length > 0) {
        useNotificationsStore.getState().replaceNotifications(updated);
      }
    },
  });
}

export function useDeleteNotifications() {
  const queryClient = useQueryClient();
  const removeNotifications = useNotificationsStore((state) => state.removeNotifications);

  return useMutation({
    mutationKey: ["notifications", "delete"],
    mutationFn: ({ ids }: { ids: string[] }) => apiClient.deleteNotifications(ids),
    onMutate: async ({ ids }) => {
      const snapshot = ids.map((id) => useNotificationsStore.getState().items[id]).filter(Boolean);
      removeNotifications(ids);
      removeFromFeedQueries(queryClient, ids);
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        useNotificationsStore.getState().restoreNotifications(context.snapshot);
        queryClient.invalidateQueries({ queryKey: notificationsFeedQueryKey });
      }
    },
    onSuccess: () => {
      useNotificationsStore.getState().clearSelection();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsFeedQueryKey });
    },
  });
}

export function useUpdateNotificationChannel() {
  const queryClient = useQueryClient();
  const setChannelEnabled = useNotificationsStore((state) => state.setChannelEnabled);
  const setChannelPending = useNotificationsStore((state) => state.setChannelPending);

  return useMutation({
    mutationKey: ["notifications", "channel"],
    mutationFn: ({ channel, enabled }: { channel: NotificationChannel; enabled: boolean }) =>
      apiClient.updateNotificationChannel(channel, enabled),
    onMutate: async ({ channel, enabled }) => {
      const previous = useNotificationsStore.getState().channels[channel];
      setChannelPending(channel, true);
      setChannelEnabled(channel, enabled);
      return { previous };
    },
    onError: (_error, { channel }, context) => {
      if (context?.previous) {
        useNotificationsStore.getState().setChannelState(channel, context.previous);
      }
    },
    onSuccess: (updated) => {
      useNotificationsStore.getState().setChannelState(updated.channel, updated);
      queryClient.setQueriesData({ queryKey: notificationsFeedQueryKey }, (data: NotificationFeedResponse | undefined) => {
        if (!data) {
          return data;
        }

        const channels = data.channelSettings.map((channelSetting) =>
          channelSetting.channel === updated.channel ? updated : channelSetting,
        );

        return {
          ...data,
          channelSettings: channels,
        } satisfies NotificationFeedResponse;
      });
    },
    onSettled: (_data, _error, { channel }) => {
      setChannelPending(channel, false);
    },
  });
}

const paymentsWithDetailsKey = paymentsQueryOptions({ include: ["incomes", "expenses"] }).queryKey;

function invalidatePaymentQueries(queryClient: ReturnType<typeof useQueryClient>, dealId?: string) {
  const invalidations: Array<Promise<unknown>> = [
    queryClient.invalidateQueries({ queryKey: paymentsQueryOptions().queryKey }),
    queryClient.invalidateQueries({ queryKey: paymentsWithDetailsKey }),
    queryClient.invalidateQueries({ queryKey: dealsQueryKey }),
    queryClient.invalidateQueries({ queryKey: dealStageMetricsQueryKey }),
  ];

  if (dealId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: dealDetailsQueryOptions(dealId).queryKey, exact: true }),
      queryClient.invalidateQueries({ queryKey: dealPaymentsQueryOptions(dealId).queryKey }),
    );
  }

  return Promise.all(invalidations);
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["create-payment"],
    mutationFn: (payload: PaymentPayload) => apiClient.createPayment(payload),
    onSuccess: async (payment) => {
      await invalidatePaymentQueries(queryClient, payment.dealId);
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-payment"],
    mutationFn: ({ paymentId, payload }: { paymentId: string; payload: PaymentUpdatePayload }) =>
      apiClient.updatePayment(paymentId, payload),
    onSuccess: async (payment) => {
      await invalidatePaymentQueries(queryClient, payment.dealId);
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["confirm-payment"],
    mutationFn: ({ paymentId, payload }: { paymentId: string; payload: PaymentConfirmationPayload }) =>
      apiClient.confirmPayment(paymentId, payload),
    onSuccess: async (payment) => {
      await invalidatePaymentQueries(queryClient, payment.dealId);
    },
  });
}

export function useRevokePaymentConfirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["revoke-payment-confirmation"],
    mutationFn: ({ paymentId, payload }: { paymentId: string; payload: PaymentRevokePayload }) =>
      apiClient.revokePaymentConfirmation(paymentId, payload),
    onSuccess: async (payment) => {
      await invalidatePaymentQueries(queryClient, payment.dealId);
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["delete-payment"],
    mutationFn: ({ paymentId }: { paymentId: string; dealId?: string }) => apiClient.deletePayment(paymentId),
    onSuccess: async (_result, variables) => {
      await invalidatePaymentQueries(queryClient, variables.dealId);
    },
  });
}

export function useCreatePaymentIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["create-payment-income"],
    mutationFn: ({ paymentId, dealId, payload }: { paymentId: string; dealId: string; payload: PaymentEntryPayload }) =>
      apiClient.createPaymentIncome(paymentId, payload),
    onSuccess: async (_entry, variables) => {
      await invalidatePaymentQueries(queryClient, variables.dealId);
    },
  });
}

export function useUpdatePaymentIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-payment-income"],
    mutationFn: ({
      paymentId,
      incomeId,
      dealId,
      payload,
    }: {
      paymentId: string;
      incomeId: string;
      dealId: string;
      payload: PaymentEntryPayload;
    }) => apiClient.updatePaymentIncome(paymentId, incomeId, payload),
    onSuccess: async (_entry, variables) => {
      await invalidatePaymentQueries(queryClient, variables.dealId);
    },
  });
}

export function useDeletePaymentIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["delete-payment-income"],
    mutationFn: ({ paymentId, dealId, incomeId }: { paymentId: string; dealId: string; incomeId: string }) =>
      apiClient.deletePaymentIncome(paymentId, incomeId),
    onSuccess: async (_result, variables) => {
      await invalidatePaymentQueries(queryClient, variables.dealId);
    },
  });
}

export function useCreatePaymentExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["create-payment-expense"],
    mutationFn: ({ paymentId, dealId, payload }: { paymentId: string; dealId: string; payload: PaymentEntryPayload }) =>
      apiClient.createPaymentExpense(paymentId, payload),
    onSuccess: async (_entry, variables) => {
      await invalidatePaymentQueries(queryClient, variables.dealId);
    },
  });
}

export function useUpdatePaymentExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-payment-expense"],
    mutationFn: ({
      paymentId,
      expenseId,
      dealId,
      payload,
    }: {
      paymentId: string;
      expenseId: string;
      dealId: string;
      payload: PaymentEntryPayload;
    }) => apiClient.updatePaymentExpense(paymentId, expenseId, payload),
    onSuccess: async (_entry, variables) => {
      await invalidatePaymentQueries(queryClient, variables.dealId);
    },
  });
}

export function useDeletePaymentExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["delete-payment-expense"],
    mutationFn: ({ paymentId, dealId, expenseId }: { paymentId: string; dealId: string; expenseId: string }) =>
      apiClient.deletePaymentExpense(paymentId, expenseId),
    onSuccess: async (_result, variables) => {
      await invalidatePaymentQueries(queryClient, variables.dealId);
    },
  });
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

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  adminAuditLogQueryOptions,
  adminDictionariesQueryOptions,
  adminRolesQueryOptions,
  adminUsersQueryOptions,
} from "@/lib/api/admin/queries";
import type {
  AdminAuditExportFormat,
  AdminAuditFilters,
  AdminDictionaryBulkUpdatePayload,
  AdminDictionaryFilters,
  AdminDictionaryKind,
  AdminUser,
  AdminUserFilters,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
  UpsertDictionaryPayload,
} from "@/types/admin";

const adminUsersKey = ["admin", "users"] as const;
const adminRolesKey = ["admin", "roles"] as const;
const adminDictionariesKey = ["admin", "dictionaries"] as const;

type DictionaryMutationPayload = {
  entryId: string;
  payload: Partial<UpsertDictionaryPayload>;
};

type DictionaryCreationPayload = {
  kind: AdminDictionaryKind;
  payload: UpsertDictionaryPayload;
};

type AuditExportPayload = {
  format: AdminAuditExportFormat;
  filters?: AdminAuditFilters;
};

type DeleteDictionaryPayload = { entryId: string };

type DeleteUserPayload = { userId: string };

export function useAdminRoles() {
  return useQuery(adminRolesQueryOptions());
}

export function useAdminUsers(filters?: AdminUserFilters) {
  return useQuery(adminUsersQueryOptions(filters));
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin", "create-user"],
    mutationFn: (payload: CreateAdminUserPayload) => apiClient.createAdminUser(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminUsersKey }),
        queryClient.invalidateQueries({ queryKey: adminRolesKey }),
      ]);
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin", "update-user"],
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAdminUserPayload }) =>
      apiClient.updateAdminUser(userId, payload),
    onSuccess: async (user: AdminUser) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: adminUsersKey }),
        queryClient.invalidateQueries({ queryKey: adminRolesKey }),
      ];

      if (user.id) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: [...adminUsersKey, { id: user.id }] }),
        );
      }

      await Promise.all(invalidations);
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin", "delete-user"],
    mutationFn: ({ userId }: DeleteUserPayload) => apiClient.deleteAdminUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminUsersKey });
    },
  });
}

export function useAdminDictionaries(filters?: AdminDictionaryFilters) {
  return useQuery(adminDictionariesQueryOptions(filters));
}

export function useCreateAdminDictionaryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin", "create-dictionary"],
    mutationFn: ({ kind, payload }: DictionaryCreationPayload) =>
      apiClient.createAdminDictionaryEntry(kind, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminDictionariesKey });
    },
  });
}

export function useUpdateAdminDictionaryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin", "update-dictionary"],
    mutationFn: ({ entryId, payload }: DictionaryMutationPayload) =>
      apiClient.updateAdminDictionaryEntry(entryId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminDictionariesKey });
    },
  });
}

export function useBulkUpdateAdminDictionaryEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin", "bulk-update-dictionaries"],
    mutationFn: (payload: AdminDictionaryBulkUpdatePayload) =>
      apiClient.bulkUpdateAdminDictionaryEntries(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminDictionariesKey });
    },
  });
}

export function useDeleteAdminDictionaryEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["admin", "delete-dictionary"],
    mutationFn: ({ entryId }: DeleteDictionaryPayload) =>
      apiClient.deleteAdminDictionaryEntry(entryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminDictionariesKey });
    },
  });
}

export function useAdminAuditLog(filters?: AdminAuditFilters) {
  return useQuery(adminAuditLogQueryOptions(filters));
}

export function useExportAdminAuditLog() {
  return useMutation({
    mutationKey: ["admin", "export-audit"],
    mutationFn: ({ format, filters }: AuditExportPayload) =>
      apiClient.exportAdminAuditLog(format, filters),
  });
}

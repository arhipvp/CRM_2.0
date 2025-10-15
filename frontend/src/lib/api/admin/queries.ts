import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  AdminAuditFilters,
  AdminDictionaryFilters,
  AdminUserFilters,
} from "@/types/admin";

const emptyObject = {} as const;

function sanitizeAdminUserFilters(filters?: AdminUserFilters): AdminUserFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const sanitized: AdminUserFilters = {};

  if (filters.search && filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  if (filters.roleIds && filters.roleIds.length > 0) {
    const uniqueRoles = Array.from(new Set(filters.roleIds.filter(Boolean)));
    if (uniqueRoles.length > 0) {
      sanitized.roleIds = uniqueRoles;
    }
  }

  if (filters.statuses && filters.statuses.length > 0) {
    const uniqueStatuses = Array.from(new Set(filters.statuses.filter(Boolean)));
    if (uniqueStatuses.length > 0) {
      sanitized.statuses = uniqueStatuses;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeAdminDictionaryFilters(
  filters?: AdminDictionaryFilters,
): AdminDictionaryFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const sanitized: AdminDictionaryFilters = {};

  if (filters.kind && filters.kind !== "all") {
    sanitized.kind = filters.kind;
  }

  if (filters.search && filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeAdminAuditFilters(filters?: AdminAuditFilters): AdminAuditFilters | undefined {
  if (!filters) {
    return undefined;
  }

  const sanitized: AdminAuditFilters = {};

  if (filters.search && filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  if (filters.scope && filters.scope !== "all") {
    sanitized.scope = filters.scope;
  }

  if (filters.severity && filters.severity !== "all") {
    sanitized.severity = filters.severity;
  }

  if (filters.actorIds && filters.actorIds.length > 0) {
    const uniqueActors = Array.from(new Set(filters.actorIds.filter(Boolean)));
    if (uniqueActors.length > 0) {
      sanitized.actorIds = uniqueActors;
    }
  }

  if (filters.dateFrom) {
    sanitized.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    sanitized.dateTo = filters.dateTo;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export const adminRolesQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "roles"] as const,
    queryFn: () => apiClient.getAdminRoles(),
  });

export const adminUsersQueryOptions = (filters?: AdminUserFilters) => {
  const sanitized = sanitizeAdminUserFilters(filters);

  return queryOptions({
    queryKey: ["admin", "users", sanitized ?? emptyObject] as const,
    queryFn: () => apiClient.getAdminUsers(sanitized),
  });
};

export const adminDictionariesQueryOptions = (filters?: AdminDictionaryFilters) => {
  const sanitized = sanitizeAdminDictionaryFilters(filters);

  return queryOptions({
    queryKey: ["admin", "dictionaries", sanitized ?? emptyObject] as const,
    queryFn: () => apiClient.getAdminDictionaries(sanitized),
  });
};

export const adminAuditLogQueryOptions = (filters?: AdminAuditFilters) => {
  const sanitized = sanitizeAdminAuditFilters(filters);

  return queryOptions({
    queryKey: ["admin", "audit", sanitized ?? emptyObject] as const,
    queryFn: () => apiClient.getAdminAuditLog(sanitized),
  });
};

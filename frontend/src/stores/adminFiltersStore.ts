import { create } from "zustand";
import type {
  AdminAuditFilters,
  AdminAuditLogEntry,
  AdminDictionaryFilters,
  AdminDictionaryKind,
  AdminUserFilters,
  AdminUserStatus,
} from "@/types/admin";

interface AdminFiltersState {
  userFilters: {
    search: string;
    roleIds: string[];
    statuses: AdminUserStatus[];
  };
  dictionaryFilters: {
    kind: AdminDictionaryKind | "all";
    search: string;
  };
  auditFilters: {
    search: string;
    scope: AdminAuditLogEntry["scope"] | "all";
    severity: AdminAuditLogEntry["severity"] | "all";
    actorIds: string[];
    dateFrom?: string;
    dateTo?: string;
  };
  setUserSearch: (value: string) => void;
  toggleUserRole: (roleId: string) => void;
  setUserStatuses: (statuses: AdminUserStatus[]) => void;
  clearUserFilters: () => void;
  setDictionaryKind: (kind: AdminDictionaryKind | "all") => void;
  setDictionarySearch: (value: string) => void;
  clearDictionaryFilters: () => void;
  setAuditSearch: (value: string) => void;
  setAuditScope: (scope: AdminAuditLogEntry["scope"] | "all") => void;
  setAuditSeverity: (severity: AdminAuditLogEntry["severity"] | "all") => void;
  toggleAuditActor: (actorId: string) => void;
  setAuditDateRange: (range: { from?: string | null; to?: string | null }) => void;
  clearAuditFilters: () => void;
}

const initialUserFilters: AdminFiltersState["userFilters"] = {
  search: "",
  roleIds: [],
  statuses: [],
};

const initialDictionaryFilters: AdminFiltersState["dictionaryFilters"] = {
  kind: "all",
  search: "",
};

const initialAuditFilters: AdminFiltersState["auditFilters"] = {
  search: "",
  scope: "all",
  severity: "all",
  actorIds: [],
};

export const useAdminFiltersStore = create<AdminFiltersState>((set) => ({
  userFilters: { ...initialUserFilters },
  dictionaryFilters: { ...initialDictionaryFilters },
  auditFilters: { ...initialAuditFilters },
  setUserSearch: (value) =>
    set((state) => ({
      userFilters: { ...state.userFilters, search: value },
    })),
  toggleUserRole: (roleId) =>
    set((state) => {
      const normalized = roleId.trim();
      if (!normalized) {
        return state;
      }

      const hasRole = state.userFilters.roleIds.includes(normalized);
      const roleIds = hasRole
        ? state.userFilters.roleIds.filter((id) => id !== normalized)
        : [...state.userFilters.roleIds, normalized];

      return { userFilters: { ...state.userFilters, roleIds } };
    }),
  setUserStatuses: (statuses) =>
    set((state) => ({
      userFilters: { ...state.userFilters, statuses: Array.from(new Set(statuses)) },
    })),
  clearUserFilters: () =>
    set(() => ({
      userFilters: { ...initialUserFilters },
    })),
  setDictionaryKind: (kind) =>
    set((state) => ({
      dictionaryFilters: { ...state.dictionaryFilters, kind },
    })),
  setDictionarySearch: (value) =>
    set((state) => ({
      dictionaryFilters: { ...state.dictionaryFilters, search: value },
    })),
  clearDictionaryFilters: () =>
    set(() => ({
      dictionaryFilters: { ...initialDictionaryFilters },
    })),
  setAuditSearch: (value) =>
    set((state) => ({
      auditFilters: { ...state.auditFilters, search: value },
    })),
  setAuditScope: (scope) =>
    set((state) => ({
      auditFilters: { ...state.auditFilters, scope },
    })),
  setAuditSeverity: (severity) =>
    set((state) => ({
      auditFilters: { ...state.auditFilters, severity },
    })),
  toggleAuditActor: (actorId) =>
    set((state) => {
      const normalized = actorId.trim();
      if (!normalized) {
        return state;
      }

      const hasActor = state.auditFilters.actorIds.includes(normalized);
      const actorIds = hasActor
        ? state.auditFilters.actorIds.filter((id) => id !== normalized)
        : [...state.auditFilters.actorIds, normalized];

      return { auditFilters: { ...state.auditFilters, actorIds } };
    }),
  setAuditDateRange: (range) =>
    set((state) => ({
      auditFilters: {
        ...state.auditFilters,
        dateFrom: range.from === null ? undefined : range.from ?? state.auditFilters.dateFrom,
        dateTo: range.to === null ? undefined : range.to ?? state.auditFilters.dateTo,
      },
    })),
  clearAuditFilters: () =>
    set(() => ({
      auditFilters: { ...initialAuditFilters },
    })),
}));

export function mapUserFilters(filters: AdminFiltersState["userFilters"]): AdminUserFilters | undefined {
  const sanitized: AdminUserFilters = {};

  if (filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  if (filters.roleIds.length > 0) {
    const roles = Array.from(new Set(filters.roleIds.filter(Boolean)));
    if (roles.length > 0) {
      sanitized.roleIds = roles;
    }
  }

  if (filters.statuses.length > 0) {
    const statuses = Array.from(new Set(filters.statuses.filter(Boolean)));
    if (statuses.length > 0) {
      sanitized.statuses = statuses;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function mapDictionaryFilters(
  filters: AdminFiltersState["dictionaryFilters"],
): AdminDictionaryFilters | undefined {
  const sanitized: AdminDictionaryFilters = {};

  if (filters.kind && filters.kind !== "all") {
    sanitized.kind = filters.kind;
  }

  if (filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function mapAuditFilters(filters: AdminFiltersState["auditFilters"]): AdminAuditFilters | undefined {
  const sanitized: AdminAuditFilters = {};

  if (filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }

  if (filters.scope && filters.scope !== "all") {
    sanitized.scope = filters.scope;
  }

  if (filters.severity && filters.severity !== "all") {
    sanitized.severity = filters.severity;
  }

  if (filters.actorIds.length > 0) {
    const actorIds = Array.from(new Set(filters.actorIds.filter(Boolean)));
    if (actorIds.length > 0) {
      sanitized.actorIds = actorIds;
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

export type AdminPermission =
  | "manage:users"
  | "manage:dictionaries"
  | "view:audit"
  | "export:audit";

export type AdminUserStatus = "active" | "invited" | "suspended";

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: AdminPermission[];
  isDefault?: boolean;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
  status: AdminUserStatus;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt: string;
  mfaEnabled: boolean;
}

export type AdminDictionaryKind =
  | "dealTypes"
  | "taskStatuses"
  | "policyStatuses"
  | "taskTags";

export interface AdminDictionaryEntry {
  id: string;
  kind: AdminDictionaryKind;
  code: string;
  label: string;
  description?: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  scope: "user" | "dictionary" | "security" | "integration";
  action: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  entityId?: string;
  entityType?: string;
  changes?: Array<{ field: string; before?: string | null; after?: string | null }>;
  metadata?: Record<string, unknown>;
}

export interface AdminUserFilters {
  search?: string;
  roleIds?: string[];
  statuses?: AdminUserStatus[];
}

export interface AdminDictionaryFilters {
  kind?: AdminDictionaryKind | "all";
  search?: string;
}

export interface AdminAuditFilters {
  actorIds?: string[];
  scope?: AdminAuditLogEntry["scope"] | "all";
  severity?: AdminAuditLogEntry["severity"] | "all";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type AdminAuditExportFormat = "csv" | "json";

export interface AdminAuditExportResult {
  fileName: string;
  mimeType: string;
  content: string;
}

export interface CreateAdminUserPayload {
  fullName: string;
  email: string;
  roleId: string;
  status?: AdminUserStatus;
  mfaEnabled?: boolean;
}

export interface UpdateAdminUserPayload {
  fullName?: string;
  email?: string;
  roleId?: string;
  status?: AdminUserStatus;
  mfaEnabled?: boolean;
}

export interface UpsertDictionaryPayload {
  code: string;
  label: string;
  description?: string;
  isActive?: boolean;
}

export interface AdminDictionaryBulkUpdatePayload {
  entries: Array<{
    id: string;
    changes: Partial<Pick<AdminDictionaryEntry, "label" | "description" | "isActive">>;
  }>;
}

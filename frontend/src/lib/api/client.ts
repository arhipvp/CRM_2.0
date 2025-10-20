import {
  adminAuditLogMock,
  adminDictionariesMock,
  adminRolesMock,
  adminUsersMock,
  notificationChannelSettingsMock,
  notificationEventJournalMock,
  notificationFeedMock,
} from "@/mocks/data";
import type {
  ActivityLogEntry,
  Client,
  ClientContact,
  ClientPolicy,
  ClientPolicyStatus,
  ClientReminderCalendarItem,
  ClientTaskChecklistItem,
  Deal,
  DealDetailsData,
  DealDocument,
  DealFilters,
  DealPeriodFilter,
  DealNote,
  DealStage,
  DealStageMetrics,
  PaginatedResult,
  Payment,
  PaymentEntry,
  PaymentStatus,
  Task,
  TaskActivityType,
  TaskChecklistItem,
  TaskComment,
  TaskStatus,
} from "@/types/crm";
import type {
  NotificationChannel,
  NotificationChannelState,
  NotificationEventEntry,
  NotificationEventJournalFilters,
  NotificationEventJournalResponse,
  NotificationFilterOption,
  NotificationFeedFilters,
  NotificationFeedItem,
  NotificationFeedResponse,
} from "@/types/notifications";
import type {
  AdminAuditExportFormat,
  AdminAuditExportResult,
  AdminAuditFilters,
  AdminAuditLogEntry,
  AdminDictionaryEntry,
  AdminDictionaryFilters,
  AdminDictionaryKind,
  AdminDictionaryBulkUpdatePayload,
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserFilters,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
  UpsertDictionaryPayload,
} from "@/types/admin";
import { sortDealsByNextReview } from "@/lib/utils/deals";
import { createRandomId } from "@/lib/utils/id";
import { NO_MANAGER_VALUE } from "@/lib/utils/managers";

type CrmDeal = {
  id: string;
  client_id: string;
  title: string;
  description?: string | null;
  status: string;
  stage?: DealStage;
  owner_id?: string | null;
  next_review_at: string;
  created_at: string;
  updated_at: string;
};

type CrmDealStageMetric = {
  stage: DealStage;
  count: number;
  total_value: number;
  conversion_rate: number;
  avg_cycle_duration_days: number | null;
};

type CrmClientSummary = {
  id: string;
  name?: string | null;
};

export interface CreateDealPayload {
  name: string;
  clientId: string;
  nextReviewAt: string;
  ownerId?: string | null;
  description?: string | null;
}

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  serverTimeoutMs?: number;
  adminPermissions?: AdminPermission[];
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_SERVER_TIMEOUT_MS = 7_500;
const DEFAULT_ADMIN_PERMISSIONS: AdminPermission[] = [
  "manage:users",
  "manage:dictionaries",
  "view:audit",
  "export:audit",
];

function parseTimeout(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

const ENV_TIMEOUT_MS = parseTimeout(process.env.FRONTEND_PROXY_TIMEOUT);
const ENV_SERVER_TIMEOUT_MS = parseTimeout(process.env.FRONTEND_SERVER_TIMEOUT_MS);

function normalizeTimeout(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function mergeAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const activeSignals = signals.filter(Boolean) as AbortSignal[];

  if (activeSignals.length === 0) {
    return undefined;
  }

  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  const controller = new AbortController();
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) {
      // `reason` доступен не во всех окружениях, поэтому подстрахуемся.
      const reason = (signal as AbortSignal & { reason?: unknown }).reason;
      controller.abort(reason);
    }
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abort(signal);
      break;
    }

    signal.addEventListener("abort", () => abort(signal), { once: true });
  }

  return controller.signal;
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.trim();
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    return trimmedBase;
  }

  // Если path уже абсолютный URL, используем его без изменений.
  try {
    return new URL(trimmedPath).toString();
  } catch {
    // noop — путь относительный.
  }

  const base = new URL(trimmedBase);

  let hash = "";
  let rest = trimmedPath;
  const hashIndex = rest.indexOf("#");
  if (hashIndex !== -1) {
    hash = rest.slice(hashIndex);
    rest = rest.slice(0, hashIndex);
  }

  let search = "";
  let pathPart = rest;
  const searchIndex = pathPart.indexOf("?");
  if (searchIndex !== -1) {
    search = pathPart.slice(searchIndex);
    pathPart = pathPart.slice(0, searchIndex);
  }

  const basePath = base.pathname === "/" ? "" : base.pathname.replace(/\/+$/, "");

  let joinedPath: string;
  if (!pathPart) {
    joinedPath = basePath || "/";
  } else if (pathPart.startsWith("/")) {
    joinedPath = `${basePath}${pathPart}`;
  } else {
    joinedPath = `${basePath}/${pathPart}`;
  }

  if (!joinedPath.startsWith("/")) {
    joinedPath = `/${joinedPath}`;
  }

  base.pathname = joinedPath;
  base.search = search;
  base.hash = hash;

  return base.toString();
}

const NOTIFICATION_SOURCE_LABELS: Record<NotificationFeedItem["source"], string> = {
  crm: "CRM",
  payments: "Платежи",
  system: "Система",
};

const NOTIFICATION_CATEGORY_LABELS: Record<NotificationFeedItem["category"], string> = {
  deal: "Сделки",
  task: "Задачи",
  payment: "Платежи",
  security: "Безопасность",
  system: "Система",
};

function cloneNotification(item: NotificationFeedItem): NotificationFeedItem {
  return {
    ...item,
    context: item.context ? { ...item.context, link: item.context.link ? { ...item.context.link } : undefined } : undefined,
    tags: item.tags ? [...item.tags] : undefined,
    channels: [...item.channels],
  };
}

function matchesNotificationStatus(item: NotificationFeedItem, status: NotificationFeedFilters["status"]): boolean {
  if (!status || status === "all") {
    return true;
  }

  switch (status) {
    case "unread":
      return !item.read;
    case "important":
      return item.important;
    case "failed":
      return item.deliveryStatus === "failed";
    default:
      return true;
  }
}

function matchesNotificationSearch(item: NotificationFeedItem, search?: string): boolean {
  if (!search) {
    return true;
  }

  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const haystack = [
    item.title,
    item.message,
    ...(item.tags ?? []),
    item.context?.dealId ?? "",
    item.context?.clientId ?? "",
  ]
    .filter(Boolean)
    .join(" \u0000")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesNotificationFeedFilters(
  item: NotificationFeedItem,
  filters?: NotificationFeedFilters,
): boolean {
  if (!filters) {
    return true;
  }

  if (filters.category && filters.category !== "all" && item.category !== filters.category) {
    return false;
  }

  if (filters.source && filters.source !== "all" && item.source !== filters.source) {
    return false;
  }

  if (!matchesNotificationStatus(item, filters.status)) {
    return false;
  }

  if (!matchesNotificationSearch(item, filters.search)) {
    return false;
  }

  return true;
}

function sortNotifications(items: NotificationFeedItem[]): NotificationFeedItem[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function buildNotificationFilterOptions(
  items: NotificationFeedItem[],
  key: "category" | "source",
): NotificationFilterOption[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const value = item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const options = Array.from(counts.entries()).map(([value, count]) => ({
    value,
    count,
    label:
      key === "source"
        ? NOTIFICATION_SOURCE_LABELS[value as NotificationFeedItem["source"]] ?? value
        : NOTIFICATION_CATEGORY_LABELS[value as NotificationFeedItem["category"]] ?? value,
  }));

  options.sort((a, b) => a.label.localeCompare(b.label, "ru"));

  return options;
}

function cloneNotificationChannel(state: NotificationChannelState): NotificationChannelState {
  return { ...state };
}

function cloneEvent(entry: NotificationEventEntry): NotificationEventEntry {
  return {
    ...entry,
    tags: entry.tags ? [...entry.tags] : undefined,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
  };
}

function matchesEventFilters(entry: NotificationEventEntry, filters?: NotificationEventJournalFilters): boolean {
  if (!filters) {
    return true;
  }

  if (filters.category && filters.category !== "all" && entry.category !== filters.category) {
    return false;
  }

  if (filters.source && filters.source !== "all" && entry.source !== filters.source) {
    return false;
  }

  if (filters.severity && filters.severity !== "all" && entry.severity !== filters.severity) {
    return false;
  }

  if (filters.search) {
    const query = filters.search.trim().toLowerCase();
    if (query) {
      const haystack = [
        entry.summary,
        entry.actor,
        ...(entry.tags ?? []),
        ...Object.values(entry.metadata ?? {}),
      ]
        .filter(Boolean)
        .join(" \u0000")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }
  }

  return true;
}

function mapStatusToStage(status: string | undefined): DealStage {
  switch ((status ?? "").toLowerCase()) {
    case "in_progress":
    case "negotiation":
      return "negotiation";
    case "proposal":
      return "proposal";
    case "won":
    case "closed_won":
      return "closedWon";
    case "lost":
    case "closed_lost":
      return "closedLost";
    default:
      return "qualification";
  }
}
function sortEvents(items: NotificationEventEntry[]): NotificationEventEntry[] {
  return [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function buildEventFilterOptions(
  items: NotificationEventEntry[],
  key: "category" | "source",
): NotificationFilterOption[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const value = item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const options = Array.from(counts.entries()).map(([value, count]) => ({
    value,
    count,
    label:
      key === "source"
        ? NOTIFICATION_SOURCE_LABELS[value as NotificationFeedItem["source"]] ?? value
        : NOTIFICATION_CATEGORY_LABELS[value as NotificationFeedItem["category"]] ?? value,
  }));

  options.sort((a, b) => a.label.localeCompare(b.label, "ru"));

  return options;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

function normalizeSearch(value?: string) {
  return value?.trim().toLowerCase();
}

function applyAdminUserFilters(users: AdminUser[], filters?: AdminUserFilters) {
  if (!filters) {
    return users;
  }

  const search = normalizeSearch(filters.search);
  const roles = filters.roleIds?.filter(Boolean);
  const statuses = filters.statuses?.filter(Boolean);

  return users.filter((user) => {
    if (roles && roles.length > 0 && !roles.includes(user.roleId)) {
      return false;
    }

    if (statuses && statuses.length > 0 && !statuses.includes(user.status)) {
      return false;
    }

    if (search) {
      const haystack = `${user.fullName} ${user.email} ${user.roleName}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

function applyAdminDictionaryFilters(entries: AdminDictionaryEntry[], filters?: AdminDictionaryFilters) {
  if (!filters) {
    return entries;
  }

  const search = normalizeSearch(filters.search);
  const kind = filters.kind && filters.kind !== "all" ? filters.kind : undefined;

  return entries.filter((entry) => {
    if (kind && entry.kind !== kind) {
      return false;
    }

    if (search) {
      const haystack = `${entry.label} ${entry.code} ${entry.description ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

function applyAdminAuditFilters(entries: AdminAuditLogEntry[], filters?: AdminAuditFilters) {
  if (!filters) {
    return entries;
  }

  const search = normalizeSearch(filters.search);
  const scope = filters.scope && filters.scope !== "all" ? filters.scope : undefined;
  const severity = filters.severity && filters.severity !== "all" ? filters.severity : undefined;
  const actorIds = filters.actorIds?.filter(Boolean);
  const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const toDate = filters.dateTo ? new Date(filters.dateTo) : undefined;

  return entries.filter((entry) => {
    if (actorIds && actorIds.length > 0 && !actorIds.includes(entry.actorId)) {
      return false;
    }

    if (scope && entry.scope !== scope) {
      return false;
    }

    if (severity && entry.severity !== severity) {
      return false;
    }

    if (fromDate || toDate) {
      const createdAt = new Date(entry.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      if (fromDate && createdAt < fromDate) {
        return false;
      }

      if (toDate && createdAt > toDate) {
        return false;
      }
    }

    if (search) {
      const haystack = `${entry.actorName} ${entry.summary} ${entry.action} ${entry.actorRole}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

function resolveRoleName(roleId: string): string {
  return adminRolesMock.find((role) => role.id === roleId)?.name ?? "Неизвестная роль";
}

function escapeCsvValue(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }

  const stringValue = String(value);
  if (stringValue.includes(";") || stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function serializeAuditToCsv(entries: AdminAuditLogEntry[]): string {
  const header = [
    "createdAt",
    "actorName",
    "actorRole",
    "scope",
    "action",
    "summary",
    "severity",
    "entityType",
    "entityId",
  ];

  const lines = entries.map((entry) =>
    [
      escapeCsvValue(entry.createdAt),
      escapeCsvValue(entry.actorName),
      escapeCsvValue(entry.actorRole),
      escapeCsvValue(entry.scope),
      escapeCsvValue(entry.action),
      escapeCsvValue(entry.summary),
      escapeCsvValue(entry.severity),
      escapeCsvValue(entry.entityType ?? ""),
      escapeCsvValue(entry.entityId ?? ""),
    ].join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

export interface DealTaskPayload {
  title: string;
  dueDate?: string;
  owner?: string;
}

export interface DealNotePayload {
  content: string;
}

export interface DealDocumentPayload {
  title: string;
  fileName: string;
  fileSize: number;
  url?: string;
}

export interface PaymentPayload {
  dealId: string;
  clientId: string;
  policyNumber: string;
  policyId?: string;
  plannedDate: string;
  plannedAmount: number;
  currency: string;
  status?: PaymentStatus;
  comment?: string;
  actualDate?: string | null;
  actualAmount?: number | null;
  recordedBy?: string;
  recordedByRole?: string;
}

export interface PaymentUpdatePayload {
  plannedDate?: string;
  plannedAmount?: number;
  currency?: string;
  status?: PaymentStatus;
  comment?: string | null;
  actualDate?: string | null;
  actualAmount?: number | null;
  recordedBy?: string | null;
  recordedByRole?: string | null;
  changeReason?: string | null;
}

export interface PaymentConfirmationPayload {
  actualAmount: number;
  actualDate: string;
  recordedBy: string;
  recordedByRole?: string;
  comment?: string;
}

export interface PaymentRevokePayload {
  recordedBy: string;
  recordedByRole?: string;
  reason?: string;
}

export interface CreateTaskPayload {
  title: string;
  dueDate: string;
  owner: string;
  status?: TaskStatus;
  type?: TaskActivityType;
  tags?: string[];
  dealId?: string;
  clientId?: string;
  reminderAt?: string | null;
  description?: string;
  checklist?: TaskChecklistItem[];
  comments?: TaskComment[];
}

export interface PaymentEntryAttachmentPayload {
  id?: string;
  fileName: string;
  fileSize: number;
  uploadedAt?: string;
  uploadedBy?: string;
  url?: string;
}

export interface PaymentEntryPayload {
  category?: string;
  plannedAmount?: number;
  plannedPostedAt?: string;
  note?: string;
  actualAmount?: number | null;
  actualPostedAt?: string | null;
  reason?: string | null;
  attachments?: PaymentEntryAttachmentPayload[];
}
export type UpdateTaskPayload = Partial<
  Pick<
    Task,
    | "status"
    | "owner"
    | "dueDate"
    | "tags"
    | "type"
    | "reminderAt"
    | "completed"
    | "description"
    | "checklist"
    | "comments"
  >
>;

export interface UpsertClientPolicyPayload {
  number: string;
  product: string;
  insurer: string;
  premium: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status?: ClientPolicyStatus;
  tags?: string[];
  coverageSummary?: string;
  managerId?: string;
  managerName?: string;
  managerTitle?: string;
  managerEmail?: string;
  managerPhone?: string;
}

export interface UpdateClientContactsPayload {
  email: string;
  phone: string;
  contacts?: Array<Omit<ClientContact, "id"> & { id?: string }>;
}

export interface ClientPoliciesQueryParams {
  status?: "active" | "archived";
  search?: string;
}

export interface ClientActivityQueryParams {
  type?: ActivityLogEntry["type"] | "all";
  page?: number;
  pageSize?: number;
}

export interface UpdateDealPayload {
  name?: string;
  stage?: Deal["stage"];
  probability?: number;
  expectedCloseDate?: string | null;
  owner?: string;
  nextReviewAt: string;
}

export class ApiClient {
  private adminPermissions: Set<AdminPermission>;
  private clientNameCache: Map<string, string> | null = null;

  constructor(private readonly config: ApiClientConfig = {}) {
    this.adminPermissions = new Set(config.adminPermissions ?? DEFAULT_ADMIN_PERMISSIONS);
  }

  setAdminPermissions(permissions: AdminPermission[]) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      this.adminPermissions = new Set(DEFAULT_ADMIN_PERMISSIONS);
      return;
    }

    const normalized = permissions.filter(Boolean) as AdminPermission[];
    this.adminPermissions = new Set(normalized.length > 0 ? normalized : DEFAULT_ADMIN_PERMISSIONS);
  }

  getAdminPermissions(): AdminPermission[] {
    return Array.from(this.adminPermissions);
  }

  private ensureAdminPermission(permission: AdminPermission) {
    if (!this.adminPermissions.has(permission)) {
      throw new ApiError("Недостаточно прав для выполнения операции", 403);
    }
  }

  private get baseUrl() {
    return this.config.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  private get timeoutMs(): number {
    const isServer = typeof window === "undefined";
    const configTimeout = normalizeTimeout(
      isServer ? this.config.serverTimeoutMs ?? this.config.timeoutMs : this.config.timeoutMs,
    );

    if (configTimeout !== undefined) {
      return configTimeout;
    }

    if (isServer) {
      return ENV_SERVER_TIMEOUT_MS ?? ENV_TIMEOUT_MS ?? DEFAULT_SERVER_TIMEOUT_MS;
    }

    return ENV_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    fallback?: () => T | Promise<T>,
  ): Promise<T> {
    const baseUrl = this.baseUrl?.trim();
    const useMocks = !baseUrl || baseUrl === "mock";

    if (useMocks) {
      if (fallback) {
        return await fallback();
      }
      throw new ApiError("API base URL is not configured or mock mode is enabled without a fallback");
    }

    let url: string;
    try {
      url = joinUrl(baseUrl, path);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to construct API URL";
      throw new ApiError(message);
    }

    const timeoutMs = this.timeoutMs;
    const timeoutController = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (timeoutController) {
      timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal: mergeAbortSignals([timeoutController?.signal, init?.signal ?? undefined]),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...this.config.headers,
          ...init?.headers,
        },
      });

      if (!response.ok) {
        const details = await response.text();
        throw new ApiError(details || response.statusText, response.status);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (timeoutController && timeoutController.signal.aborted) {
        throw new ApiError(`Request timed out after ${timeoutMs} ms`);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new ApiError(error.message);
      }

      throw new ApiError("Request failed");
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private buildQueryString(filters?: DealFilters): string {
    if (!filters) {
      return "";
    }

    const params = new URLSearchParams();

    if (filters.stage && filters.stage !== "all") {
      params.set("stage", filters.stage);
    }

    if (filters.managers && filters.managers.length > 0) {
      for (const manager of filters.managers) {
        params.append("manager", manager === NO_MANAGER_VALUE ? NO_MANAGER_VALUE : manager);
      }
    }

    if (filters.period && filters.period !== "all") {
      params.set("period", filters.period);
    }

    if (filters.search) {
      params.set("search", filters.search);
    }

    const query = params.toString();
    return query ? `?${query}` : "";
  }

  private buildNotificationFeedQuery(filters?: NotificationFeedFilters): string {
    if (!filters) {
      return "";
    }

    const params = new URLSearchParams();

    if (filters.category && filters.category !== "all") {
      params.set("category", filters.category);
    }

    if (filters.source && filters.source !== "all") {
      params.set("source", filters.source);
    }

    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status);
    }

    if (filters.search?.trim()) {
      params.set("search", filters.search.trim());
    }

    const query = params.toString();
    return query ? `?${query}` : "";
  }

  private buildNotificationJournalQuery(filters?: NotificationEventJournalFilters): string {
    if (!filters) {
      return "";
    }

    const params = new URLSearchParams();

    if (filters.category && filters.category !== "all") {
      params.set("category", filters.category);
    }

    if (filters.source && filters.source !== "all") {
      params.set("source", filters.source);
    }

    if (filters.severity && filters.severity !== "all") {
      params.set("severity", filters.severity);
    }

    if (filters.search?.trim()) {
      params.set("search", filters.search.trim());
    }

    const query = params.toString();
    return query ? `?${query}` : "";
  }

  private normalizeDateToIso(value: string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const candidate = value.includes("T") ? value : `${value}T00:00:00Z`;
    const parsed = new Date(candidate);

    if (!Number.isFinite(parsed.getTime())) {
      return undefined;
    }

    return parsed.toISOString();
  }

  private async ensureClientNameCache(): Promise<void> {
    if (this.clientNameCache !== null) {
      return;
    }

    try {
      const response = await this.request<CrmClientSummary[] | Client[]>(
        "/crm/clients",
        undefined,
        async () => clientsMock,
      );

      const map = new Map<string, string>();
      for (const item of response as Array<{ id?: string; name?: string | null }>) {
        if (!item || typeof item.id !== "string") {
          continue;
        }
        const label = item.name && item.name.trim().length > 0 ? item.name.trim() : item.id;
        map.set(item.id, label);
      }
      this.clientNameCache = map;
    } catch {
      this.clientNameCache = new Map();
    }
  }

  private getClientName(clientId: string): string {
    if (!this.clientNameCache) {
      return clientId;
    }
    return this.clientNameCache.get(clientId) ?? clientId;
  }

  private isCrmDealArray(value: unknown): value is CrmDeal[] {
    return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "client_id" in item);
  }

  private isCrmDeal(value: unknown): value is CrmDeal {
    return typeof value === "object" && value !== null && "client_id" in value;
  }

  private mapDealFromApi(deal: CrmDeal): Deal {
    const stage = deal.stage ?? mapStatusToStage(deal.status);
    const nextReviewAt = this.normalizeDateToIso(deal.next_review_at) ?? deal.next_review_at;
    const updatedAt = this.normalizeDateToIso(deal.updated_at) ?? deal.updated_at;
    const owner = deal.owner_id && deal.owner_id.trim().length > 0 ? deal.owner_id : NO_MANAGER_VALUE;

    return {
      id: deal.id,
      name: deal.title,
      clientId: deal.client_id,
      clientName: this.getClientName(deal.client_id),
      probability: 0,
      stage,
      owner,
      updatedAt,
      nextReviewAt,
      expectedCloseDate: undefined,
      tasks: [],
      notes: [],
      documents: [],
      payments: [],
      activity: [],
    } satisfies Deal;
  }

  private mapStageMetric(metric: CrmDealStageMetric | DealStageMetrics): DealStageMetrics {
    if (typeof (metric as CrmDealStageMetric).total_value === "number") {
      const apiMetric = metric as CrmDealStageMetric;
      return {
        stage: apiMetric.stage,
        count: apiMetric.count,
        totalValue: apiMetric.total_value,
        conversionRate: apiMetric.conversion_rate,
        avgCycleDurationDays: apiMetric.avg_cycle_duration_days,
      } satisfies DealStageMetrics;
    }

    return metric as DealStageMetrics;
  }

  async getDeals(filters?: DealFilters): Promise<Deal[]> {
    const query = this.buildQueryString(filters);
    const response = await this.request<CrmDeal[] | Deal[]>(
      `/crm/deals${query}`,
      undefined,
      async () => filterDealsMock(dealsMock, filters),
    );

    if (this.isCrmDealArray(response)) {
      await this.ensureClientNameCache();
      const mapped = response.map((deal) => this.mapDealFromApi(deal));
      return sortDealsByNextReview(mapped);
    }

    return sortDealsByNextReview(response as Deal[]);
  }

  async createDeal(payload: CreateDealPayload): Promise<Deal> {
    const title = payload.name.trim();
    const description = payload.description?.trim();
    const normalizedNextReview = this.normalizeDateToIso(payload.nextReviewAt) ?? payload.nextReviewAt;
    const ownerId = payload.ownerId && payload.ownerId !== NO_MANAGER_VALUE ? payload.ownerId.trim() : undefined;
    const response = await this.request<CrmDeal | Deal>(
      "/crm/deals",
      {
        method: "POST",
        body: JSON.stringify({
          title,
          client_id: payload.clientId,
          next_review_at: normalizedNextReview,
          owner_id: ownerId ?? null,
          description: description ?? undefined,
        }),
      },
      async () => {
        const now = new Date().toISOString();
        return {
          id: `deal-${createRandomId()}`,
          client_id: payload.clientId,
          title,
          description: description ?? null,
          status: "qualification",
          stage: "qualification",
          owner_id: ownerId ?? null,
          next_review_at: normalizedNextReview,
          created_at: now,
          updated_at: now,
        } satisfies CrmDeal;
      },
    );

    if (this.isCrmDeal(response)) {
      await this.ensureClientNameCache();
      return this.mapDealFromApi(response);
    }

    return response as Deal;
  }

  async getDealStageMetrics(filters?: DealFilters): Promise<DealStageMetrics[]> {
    const query = this.buildQueryString(filters);
    const response = await this.request<Array<CrmDealStageMetric | DealStageMetrics>>(
      `/crm/deals/stage-metrics${query}`,
      undefined,
      async () => calculateStageMetrics(filterDealsMock(dealsMock, filters)),
    );

    return response.map((metric) => this.mapStageMetric(metric));
  }

  getDealDetails(id: string): Promise<DealDetailsData> {
    return this.request(`/crm/deals/${id}`, undefined);
  }

  getDealTasks(dealId: string): Promise<Task[]> {
    return this.request(`/crm/deals/${dealId}/tasks`, undefined);
  }

  createDealTask(dealId: string, payload: DealTaskPayload): Promise<Task> {
    return this.request(
      `/crm/deals/${dealId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  getDealNotes(dealId: string): Promise<DealNote[]> {
    return this.request(`/crm/deals/${dealId}/notes`, undefined);
  }

  createDealNote(dealId: string, payload: DealNotePayload): Promise<DealNote> {
    return this.request(
      `/crm/deals/${dealId}/notes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  getDealDocuments(dealId: string): Promise<DealDocument[]> {
    return this.request(`/crm/deals/${dealId}/documents`, undefined);
  }

  uploadDealDocument(dealId: string, payload: DealDocumentPayload): Promise<DealDocument> {
    return this.request(
      `/crm/deals/${dealId}/documents`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  getDealPayments(dealId: string): Promise<Payment[]> {
    return this.request(`/crm/deals/${dealId}/payments`, undefined);
  }

  getDealActivity(dealId: string): Promise<ActivityLogEntry[]> {
    return this.request(`/crm/deals/${dealId}/activity`, undefined);
  }

  updateDeal(dealId: string, payload: UpdateDealPayload): Promise<DealDetailsData> {
    return this.request(
      `/crm/deals/${dealId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
  }

  async updateDealStage(dealId: string, stage: DealStage): Promise<Deal> {
    const response = await this.request<CrmDeal | Deal>(
      `/crm/deals/${dealId}/stage`,
      {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      },
      async () => updateDealStageMock(dealId, stage),
    );

    if (this.isCrmDeal(response)) {
      await this.ensureClientNameCache();
      return this.mapDealFromApi(response);
    }

    return response as Deal;
  }

  getClients(): Promise<Client[]> {
    return this.request("/crm/clients", undefined);
  }

  getClient(id: string): Promise<Client> {
    return this.request(`/crm/clients/${id}`, undefined);
  }

  updateClientContacts(clientId: string, payload: UpdateClientContactsPayload): Promise<Client> {
    return this.request(
      `/crm/clients/${clientId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
  }

  getClientPolicies(clientId: string, params?: ClientPoliciesQueryParams): Promise<ClientPolicy[]> {
    return this.request(
      `/crm/clients/${clientId}/policies`,
      undefined);
  }

  createClientPolicy(clientId: string, payload: UpsertClientPolicyPayload): Promise<ClientPolicy> {
    return this.request(
      `/crm/clients/${clientId}/policies`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  updateClientPolicy(policyId: string, payload: Partial<UpsertClientPolicyPayload>): Promise<ClientPolicy> {
    return this.request(
      `/crm/policies/${policyId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
  }

  getClientTasks(clientId: string): Promise<ClientTaskChecklistItem[]> {
    return this.request(
      `/crm/clients/${clientId}/tasks`,
      undefined);
  }

  toggleClientTask(taskId: string, completed: boolean): Promise<ClientTaskChecklistItem> {
    return this.request(
      `/crm/client-tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
  }

  getClientReminders(clientId: string): Promise<ClientReminderCalendarItem[]> {
    return this.request(
      `/crm/clients/${clientId}/reminders`,
      undefined);
  }

  getTasks(): Promise<Task[]> {
    return this.request("/crm/tasks", undefined);
  }

  createTask(payload: CreateTaskPayload): Promise<Task> {
    return this.request(
      "/crm/tasks",
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  async updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
    const changes = sanitizeTaskPatch(payload);

    return this.request(
      `/crm/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
  }

  getPayments(params?: { include?: Array<"incomes" | "expenses"> }): Promise<Payment[]> {
    return this.request("/crm/payments", undefined);
  }

  createPayment(payload: PaymentPayload): Promise<Payment> {
    return this.request(
      "/crm/payments",
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  updatePayment(paymentId: string, payload: PaymentUpdatePayload): Promise<Payment> {
    return this.request(
      `/crm/payments/${paymentId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
  }

  confirmPayment(paymentId: string, payload: PaymentConfirmationPayload): Promise<Payment> {
    return this.request(
      `/crm/payments/${paymentId}/confirm`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  revokePaymentConfirmation(paymentId: string, payload: PaymentRevokePayload): Promise<Payment> {
    return this.request(
      `/crm/payments/${paymentId}/revoke-confirmation`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  deletePayment(paymentId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}`,
      {
        method: "DELETE",
      });
  }

  createPaymentIncome(paymentId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/incomes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  updatePaymentIncome(paymentId: string, incomeId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/incomes/${incomeId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
  }

  deletePaymentIncome(paymentId: string, incomeId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}/incomes/${incomeId}`,
      {
        method: "DELETE",
      });
  }

  createPaymentExpense(paymentId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/expenses`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      });
  }

  updatePaymentExpense(paymentId: string, expenseId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/expenses/${expenseId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
  }

  deletePaymentExpense(paymentId: string, expenseId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}/expenses/${expenseId}`,
      {
        method: "DELETE",
      });
  }

  async bulkUpdateTasks(
    taskIds: string[],
    payload: UpdateTaskPayload,
    options?: { shiftDueDateByDays?: number },
  ): Promise<Task[]> {
    const changes = sanitizeTaskPatch(payload);

    return this.request(
      `/crm/tasks/bulk`,
      {
        method: "PATCH",
        body: JSON.stringify({ taskIds, changes, options }),
      });
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.updateTask(taskId, { status, completed: status === "done" });
  }

  getClientActivities(
    clientId: string,
    params?: ClientActivityQueryParams,
  ): Promise<PaginatedResult<ActivityLogEntry>> {
    return this.request(`/crm/clients/${clientId}/activity`, undefined);
  }

  async getNotificationFeed(filters?: NotificationFeedFilters): Promise<NotificationFeedResponse> {
    const query = this.buildNotificationFeedQuery(filters);

    return this.request(
      `/notifications/feed${query}`,
      undefined,
      async () => {
        const allItems = sortNotifications(notificationFeedMock).map(cloneNotification);
        const filteredItems = allItems.filter((item) => matchesNotificationFeedFilters(item, filters));

        return {
          items: filteredItems,
          unreadCount: notificationFeedMock.filter((item) => !item.read).length,
          availableCategories: buildNotificationFilterOptions(allItems, "category"),
          availableSources: buildNotificationFilterOptions(allItems, "source"),
          channelSettings: notificationChannelSettingsMock.map(cloneNotificationChannel),
        } satisfies NotificationFeedResponse;
      },
    );
  }

  async getNotificationEventJournal(
    filters?: NotificationEventJournalFilters,
  ): Promise<NotificationEventJournalResponse> {
    const query = this.buildNotificationJournalQuery(filters);

    return this.request(
      `/notifications/events${query}`,
      undefined,
      async () => {
        const allEvents = sortEvents(notificationEventJournalMock).map(cloneEvent);
        const filteredEvents = allEvents.filter((event) => matchesEventFilters(event, filters));

        return {
          items: filteredEvents,
          availableCategories: buildEventFilterOptions(allEvents, "category"),
          availableSources: buildEventFilterOptions(allEvents, "source"),
        } satisfies NotificationEventJournalResponse;
      },
    );
  }

  async markNotificationsRead(ids: string[]): Promise<NotificationFeedItem[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.request(
      `/notifications/feed/read`,
      {
        method: "POST",
        body: JSON.stringify({ ids }),
      },
      async () => {
        const updated: NotificationFeedItem[] = [];
        for (const item of notificationFeedMock) {
          if (ids.includes(item.id)) {
            if (!item.read) {
              item.read = true;
            }
            updated.push(cloneNotification(item));
          }
        }

        return updated;
      },
    );
  }

  async toggleNotificationsImportant(ids: string[], important: boolean): Promise<NotificationFeedItem[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.request(
      `/notifications/feed/important`,
      {
        method: "POST",
        body: JSON.stringify({ ids, important }),
      },
      async () => {
        const updated: NotificationFeedItem[] = [];
        for (const item of notificationFeedMock) {
          if (ids.includes(item.id)) {
            item.important = important;
            updated.push(cloneNotification(item));
          }
        }

        return updated;
      },
    );
  }

  async deleteNotifications(ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.request(
      `/notifications/feed`,
      {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      },
      async () => {
        const idSet = new Set(ids);
        let removed = 0;
        for (let index = notificationFeedMock.length - 1; index >= 0; index -= 1) {
          if (idSet.has(notificationFeedMock[index]?.id ?? "")) {
            notificationFeedMock.splice(index, 1);
            removed += 1;
          }
        }

        if (removed === 0) {
          throw new ApiError("Notifications not found", 404);
        }

        return ids;
      },
    );
  }

  async updateNotificationChannel(channel: NotificationChannel, enabled: boolean): Promise<NotificationChannelState> {
    return this.request(
      `/notifications/channels/${channel}`,
      {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      },
      async () => {
        const entry = notificationChannelSettingsMock.find((item) => item.channel === channel);
        if (!entry) {
          throw new ApiError("Channel not found", 404);
        }

        if (!entry.editable) {
          throw new ApiError("Channel is read-only", 400);
        }

        entry.enabled = enabled;
        entry.lastChangedAt = new Date().toISOString();

        return cloneNotificationChannel(entry);
      },
    );
  }
  getAdminRoles(): Promise<AdminRole[]> {
    this.ensureAdminPermission("manage:users");

    return this.request("/admin/roles", undefined, async () =>
      adminRolesMock.map((role) => ({ ...role, permissions: [...role.permissions] })),
    );
  }

  getAdminUsers(filters?: AdminUserFilters): Promise<AdminUser[]> {
    this.ensureAdminPermission("manage:users");

    const params = new URLSearchParams();
    if (filters?.search) {
      params.set("search", filters.search.trim());
    }
    if (filters?.roleIds && filters.roleIds.length > 0) {
      for (const roleId of filters.roleIds) {
        if (roleId) {
          params.append("roleId", roleId);
        }
      }
    }
    if (filters?.statuses && filters.statuses.length > 0) {
      for (const status of filters.statuses) {
        if (status) {
          params.append("status", status);
        }
      }
    }

    const query = params.toString();

    return this.request(`/admin/users${query ? `?${query}` : ""}`, undefined, async () => {
      const filtered = applyAdminUserFilters(adminUsersMock, filters);
      return filtered.map((user) => ({ ...user }));
    });
  }

  createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUser> {
    this.ensureAdminPermission("manage:users");

    return this.request(
      "/admin/users",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const fullName = payload.fullName.trim();
        if (!fullName) {
          throw new ApiError("ФИО обязательно", 422);
        }

        const email = payload.email.trim().toLowerCase();
        const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!emailPattern.test(email)) {
          throw new ApiError("Некорректный email", 422);
        }
        if (adminUsersMock.some((user) => user.email.toLowerCase() === email)) {
          throw new ApiError("Пользователь с таким email уже существует", 409);
        }

        const now = new Date().toISOString();
        const status = payload.status ?? "invited";
        const roleName = resolveRoleName(payload.roleId);
        const user: AdminUser = {
          id: createRandomId(),
          fullName,
          email,
          roleId: payload.roleId,
          roleName,
          status,
          lastActiveAt: status === "active" ? now : undefined,
          createdAt: now,
          updatedAt: now,
          mfaEnabled: payload.mfaEnabled ?? false,
        };

        adminUsersMock.unshift(user);
        return { ...user };
      },
    );
  }

  updateAdminUser(userId: string, payload: UpdateAdminUserPayload): Promise<AdminUser> {
    this.ensureAdminPermission("manage:users");

    return this.request(
      `/admin/users/${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const user = adminUsersMock.find((item) => item.id === userId);
        if (!user) {
          throw new ApiError("Пользователь не найден", 404);
        }

        if (payload.email !== undefined) {
          const email = payload.email.trim().toLowerCase();
          const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
          if (!emailPattern.test(email)) {
            throw new ApiError("Некорректный email", 422);
          }
          if (adminUsersMock.some((item) => item.id !== userId && item.email.toLowerCase() === email)) {
            throw new ApiError("Пользователь с таким email уже существует", 409);
          }
          user.email = email;
        }

        if (payload.fullName !== undefined) {
          const fullName = payload.fullName.trim();
          if (!fullName) {
            throw new ApiError("ФИО обязательно", 422);
          }
          user.fullName = fullName;
        }

        if (payload.roleId !== undefined) {
          user.roleId = payload.roleId;
          user.roleName = resolveRoleName(payload.roleId);
        }

        if (payload.status !== undefined) {
          user.status = payload.status;
          if (payload.status === "active" && !user.lastActiveAt) {
            user.lastActiveAt = new Date().toISOString();
          }
        }

        if (payload.mfaEnabled !== undefined) {
          user.mfaEnabled = payload.mfaEnabled;
        }

        user.updatedAt = new Date().toISOString();

        return { ...user };
      },
    );
  }

  deleteAdminUser(userId: string): Promise<{ id: string }> {
    this.ensureAdminPermission("manage:users");

    return this.request(
      `/admin/users/${userId}`,
      {
        method: "DELETE",
      },
      async () => {
        const index = adminUsersMock.findIndex((item) => item.id === userId);
        if (index === -1) {
          throw new ApiError("Пользователь не найден", 404);
        }

        adminUsersMock.splice(index, 1);
        return { id: userId };
      },
    );
  }

  getAdminDictionaries(filters?: AdminDictionaryFilters): Promise<AdminDictionaryEntry[]> {
    this.ensureAdminPermission("manage:dictionaries");

    const params = new URLSearchParams();
    if (filters?.kind && filters.kind !== "all") {
      params.set("kind", filters.kind);
    }
    if (filters?.search) {
      params.set("search", filters.search.trim());
    }

    const query = params.toString();

    return this.request(`/admin/dictionaries${query ? `?${query}` : ""}`, undefined, async () => {
      const filtered = applyAdminDictionaryFilters(adminDictionariesMock, filters);
      return filtered.map((entry) => ({ ...entry }));
    });
  }

  createAdminDictionaryEntry(kind: AdminDictionaryKind, payload: UpsertDictionaryPayload): Promise<AdminDictionaryEntry> {
    this.ensureAdminPermission("manage:dictionaries");

    return this.request(
      `/admin/dictionaries/${kind}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const code = payload.code.trim();
        if (!code) {
          throw new ApiError("Код обязателен", 422);
        }
        const label = payload.label.trim();
        if (!label) {
          throw new ApiError("Название обязательно", 422);
        }
        if (
          adminDictionariesMock.some(
            (entry) => entry.kind === kind && entry.code.toLowerCase() === code.toLowerCase(),
          )
        ) {
          throw new ApiError("Справочник с таким кодом уже существует", 409);
        }

        const now = new Date().toISOString();
        const entry: AdminDictionaryEntry = {
          id: createRandomId(),
          kind,
          code,
          label,
          description: payload.description?.trim(),
          isActive: payload.isActive ?? true,
          updatedAt: now,
          updatedBy: "Вы",
        };

        adminDictionariesMock.unshift(entry);
        return { ...entry };
      },
    );
  }

  updateAdminDictionaryEntry(
    entryId: string,
    payload: Partial<UpsertDictionaryPayload>,
  ): Promise<AdminDictionaryEntry> {
    this.ensureAdminPermission("manage:dictionaries");

    return this.request(
      `/admin/dictionaries/${entryId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const entry = adminDictionariesMock.find((item) => item.id === entryId);
        if (!entry) {
          throw new ApiError("Запись справочника не найдена", 404);
        }

        if (payload.code !== undefined) {
          const code = payload.code.trim();
          if (!code) {
            throw new ApiError("Код обязателен", 422);
          }
          if (
            adminDictionariesMock.some(
              (item) => item.id !== entryId && item.kind === entry.kind && item.code.toLowerCase() === code.toLowerCase(),
            )
          ) {
            throw new ApiError("Справочник с таким кодом уже существует", 409);
          }
          entry.code = code;
        }

        if (payload.label !== undefined) {
          const label = payload.label.trim();
          if (!label) {
            throw new ApiError("Название обязательно", 422);
          }
          entry.label = label;
        }

        if (payload.description !== undefined) {
          entry.description = payload.description?.trim();
        }

        if (payload.isActive !== undefined) {
          entry.isActive = payload.isActive;
        }

        entry.updatedAt = new Date().toISOString();
        entry.updatedBy = "Вы";

        return { ...entry };
      },
    );
  }

  bulkUpdateAdminDictionaryEntries(payload: AdminDictionaryBulkUpdatePayload): Promise<AdminDictionaryEntry[]> {
    this.ensureAdminPermission("manage:dictionaries");

    return this.request(
      "/admin/dictionaries/bulk",
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const updated: AdminDictionaryEntry[] = [];
        for (const change of payload.entries) {
          const entry = adminDictionariesMock.find((item) => item.id === change.id);
          if (!entry) {
            continue;
          }

          if (change.changes.label !== undefined) {
            const label = change.changes.label.trim();
            if (!label) {
              throw new ApiError("Название обязательно", 422);
            }
            entry.label = label;
          }

          if (change.changes.description !== undefined) {
            entry.description = change.changes.description?.trim();
          }

          if (change.changes.isActive !== undefined) {
            entry.isActive = change.changes.isActive;
          }

          entry.updatedAt = new Date().toISOString();
          entry.updatedBy = "Вы";
          updated.push({ ...entry });
        }

        if (updated.length === 0) {
          throw new ApiError("Нет записей для обновления", 404);
        }

        return updated;
      },
    );
  }

  deleteAdminDictionaryEntry(entryId: string): Promise<{ id: string }> {
    this.ensureAdminPermission("manage:dictionaries");

    return this.request(
      `/admin/dictionaries/${entryId}`,
      {
        method: "DELETE",
      },
      async () => {
        const index = adminDictionariesMock.findIndex((item) => item.id === entryId);
        if (index === -1) {
          throw new ApiError("Запись справочника не найдена", 404);
        }

        adminDictionariesMock.splice(index, 1);
        return { id: entryId };
      },
    );
  }

  getAdminAuditLog(filters?: AdminAuditFilters): Promise<AdminAuditLogEntry[]> {
    this.ensureAdminPermission("view:audit");

    const params = new URLSearchParams();
    if (filters?.search) {
      params.set("search", filters.search.trim());
    }
    if (filters?.scope && filters.scope !== "all") {
      params.set("scope", filters.scope);
    }
    if (filters?.severity && filters.severity !== "all") {
      params.set("severity", filters.severity);
    }
    if (filters?.actorIds && filters.actorIds.length > 0) {
      for (const actorId of filters.actorIds) {
        if (actorId) {
          params.append("actorId", actorId);
        }
      }
    }
    if (filters?.dateFrom) {
      params.set("dateFrom", filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.set("dateTo", filters.dateTo);
    }

    const query = params.toString();

    return this.request(`/admin/audit${query ? `?${query}` : ""}`, undefined, async () => {
      const filtered = applyAdminAuditFilters(adminAuditLogMock, filters);
      return filtered
        .map((entry) => ({ ...entry, changes: entry.changes ? entry.changes.map((item) => ({ ...item })) : undefined }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }

  exportAdminAuditLog(format: AdminAuditExportFormat, filters?: AdminAuditFilters): Promise<AdminAuditExportResult> {
    this.ensureAdminPermission("export:audit");

    const params = new URLSearchParams();
    params.set("format", format);
    if (filters?.search) {
      params.set("search", filters.search.trim());
    }
    if (filters?.scope && filters.scope !== "all") {
      params.set("scope", filters.scope);
    }
    if (filters?.severity && filters.severity !== "all") {
      params.set("severity", filters.severity);
    }
    if (filters?.actorIds && filters.actorIds.length > 0) {
      for (const actorId of filters.actorIds) {
        if (actorId) {
          params.append("actorId", actorId);
        }
      }
    }
    if (filters?.dateFrom) {
      params.set("dateFrom", filters.dateFrom);
    }
    if (filters?.dateTo) {
      params.set("dateTo", filters.dateTo);
    }

    const query = params.toString();

    return this.request(`/admin/audit/export?${query}`, undefined, async () => {
      const entries = applyAdminAuditFilters(adminAuditLogMock, filters).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      if (format === "json") {
        return {
          fileName: `audit-log-${new Date().toISOString()}.json`,
          mimeType: "application/json",
          content: JSON.stringify(entries, null, 2),
        } satisfies AdminAuditExportResult;
      }

      return {
        fileName: `audit-log-${new Date().toISOString()}.csv`,
        mimeType: "text/csv",
        content: serializeAuditToCsv(entries),
      } satisfies AdminAuditExportResult;
    });
  }
}

function sanitizeTaskPatch(patch: UpdateTaskPayload): UpdateTaskPayload {
  const result = {} as UpdateTaskPayload;

  for (const key of Object.keys(patch) as Array<keyof UpdateTaskPayload>) {
    const value = patch[key];
    if (value !== undefined) {
      Object.assign(result, { [key]: value });
    }
  }

  return result;
}

function applyTaskPatch(task: Task, patch: UpdateTaskPayload): Task {
  if (patch.status) {
    task.status = patch.status;
    task.completed = patch.completed ?? patch.status === "done";
  }

  if (patch.completed !== undefined && !patch.status) {
    task.completed = patch.completed;
    if (patch.completed) {
      task.status = "done";
    } else if (task.status === "done") {
      task.status = "in_progress";
    }
  }

  if (patch.owner !== undefined) {
    task.owner = patch.owner;
  }

  if (patch.dueDate !== undefined) {
    task.dueDate = patch.dueDate;
  }

  if (patch.tags !== undefined) {
    task.tags = [...patch.tags];
  }

  if (patch.type !== undefined) {
    task.type = patch.type;
  }

  if (patch.reminderAt !== undefined) {
    task.reminderAt = patch.reminderAt;
  }

  if (patch.description !== undefined) {
    task.description = patch.description;
  }

  if (patch.checklist !== undefined) {
    task.checklist = patch.checklist?.map((item) => ({ ...item })) ?? [];
  }

  if (patch.comments !== undefined) {
    task.comments = patch.comments?.map((comment) => ({ ...comment })) ?? [];
  }

  return task;
}

export const apiClient = new ApiClient();

export function createApiClient(config: ApiClientConfig = {}) {
  return new ApiClient(config);
}

export function getServerApiClient(config: ApiClientConfig = {}) {
  const serverConfig: ApiClientConfig = { ...config };

  if (serverConfig.serverTimeoutMs === undefined) {
    const normalizedTimeout = normalizeTimeout(serverConfig.timeoutMs);
    if (normalizedTimeout !== undefined) {
      serverConfig.serverTimeoutMs = normalizedTimeout;
    } else {
      serverConfig.serverTimeoutMs = ENV_SERVER_TIMEOUT_MS ?? ENV_TIMEOUT_MS ?? DEFAULT_SERVER_TIMEOUT_MS;
    }
  }

  return createApiClient(serverConfig);
}

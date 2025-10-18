import {
  activitiesMock,
  adminAuditLogMock,
  adminDictionariesMock,
  adminRolesMock,
  adminUsersMock,
  clientPoliciesMock,
  clientRemindersMock,
  clientTaskChecklistMock,
  clientsMock,
  dealDetailsMock,
  dealDocumentsMock,
  dealNotesMock,
  dealsMock,
  notificationChannelSettingsMock,
  notificationEventJournalMock,
  notificationFeedMock,
  paymentsMock,
  tasksMock,
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
import { compareDealsByNextReview, sortDealsByNextReview } from "@/lib/utils/deals";
import { createRandomId } from "@/lib/utils/id";
import { NO_MANAGER_VALUE } from "@/lib/utils/managers";

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
  value?: number;
  probability?: number;
  expectedCloseDate?: string | null;
  owner?: string;
  nextReviewAt: string;
}

export class ApiClient {
  private adminPermissions: Set<AdminPermission>;

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

    const resolveWithFallback = async (
      error?: unknown,
      missingFallbackMessage?: string,
    ): Promise<T> => {
      if (fallback) {
        return await fallback();
      }

      if (error instanceof ApiError) {
        throw error;
      }

      if (missingFallbackMessage) {
        throw new ApiError(missingFallbackMessage);
      }

      if (error instanceof Error) {
        throw new ApiError(error.message);
      }

      throw new ApiError("Request failed");
    };

    if (useMocks) {
      return await resolveWithFallback(
        undefined,
        "API base URL is not configured or mock mode is enabled without a fallback",
      );
    }

    let url: string;
    try {
      url = new URL(path, baseUrl).toString();
    } catch (error) {
      return await resolveWithFallback(
        error,
        "Failed to construct API URL and no fallback is available",
      );
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
        const timeoutError = new ApiError(`Request timed out after ${timeoutMs} ms`);
        return await resolveWithFallback(timeoutError, "Request timed out and no fallback is available");
      }

      if (error instanceof ApiError) {
        throw error;
      }

      return await resolveWithFallback(error, "Request failed and no fallback is available");
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

  async getDeals(filters?: DealFilters): Promise<Deal[]> {
    const query = this.buildQueryString(filters);
    const deals = await this.request(`/crm/deals${query}`, undefined, async () => filterDealsMock(dealsMock, filters));
    return sortDealsByNextReview(deals);
  }

  getDealDetails(id: string): Promise<DealDetailsData> {
    return this.request(`/crm/deals/${id}`, undefined, async () => {
      const deal = dealDetailsMock[id];
      if (!deal) {
        throw new ApiError("Deal not found", 404);
      }

      const details = JSON.parse(JSON.stringify(deal)) as DealDetailsData;
      const base = dealsMock.find((item) => item.id === id);
      if (base) {
        details.value = base.value;
        details.probability = base.probability;
        details.stage = base.stage;
        details.owner = base.owner;
        details.nextReviewAt = base.nextReviewAt;
        details.expectedCloseDate = base.expectedCloseDate;
        details.updatedAt = base.updatedAt;
      }

      const tasks = tasksMock.filter((item) => item.dealId === id);
      const notes = dealNotesMock.filter((item) => item.dealId === id);
      const documents = dealDocumentsMock.filter((item) => item.dealId === id);
      const payments = paymentsMock
        .filter((item) => item.dealId === id)
        .map((payment) => clonePayment(payment));
      const activity = activitiesMock.filter((item) => item.dealId === id);

      return {
        ...details,
        tasks,
        notes,
        documents,
        payments,
        activity,
      };
    });
  }

  getDealTasks(dealId: string): Promise<Task[]> {
    return this.request(`/crm/deals/${dealId}/tasks`, undefined, async () =>
      tasksMock.filter((task) => task.dealId === dealId),
    );
  }

  createDealTask(dealId: string, payload: DealTaskPayload): Promise<Task> {
    return this.request(
      `/crm/deals/${dealId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const deal = dealsMock.find((item) => item.id === dealId);
        const task: Task = {
          id: createRandomId(),
          title: payload.title,
          dueDate: payload.dueDate ?? new Date().toISOString(),
          status: "new",
          completed: false,
          owner: payload.owner ?? deal?.owner ?? "",
          type: "other",
          tags: [],
          dealId,
          clientId: deal?.clientId,
        };
        tasksMock.unshift(task);
        return task;
      },
    );
  }

  getDealNotes(dealId: string): Promise<DealNote[]> {
    return this.request(`/crm/deals/${dealId}/notes`, undefined, async () =>
      dealNotesMock.filter((note) => note.dealId === dealId),
    );
  }

  createDealNote(dealId: string, payload: DealNotePayload): Promise<DealNote> {
    return this.request(
      `/crm/deals/${dealId}/notes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const note: DealNote = {
          id: createRandomId(),
          dealId,
          author: "Вы",
          content: payload.content,
          createdAt: new Date().toISOString(),
        };
        dealNotesMock.unshift(note);
        return note;
      },
    );
  }

  getDealDocuments(dealId: string): Promise<DealDocument[]> {
    return this.request(`/crm/deals/${dealId}/documents`, undefined, async () =>
      dealDocumentsMock.filter((doc) => doc.dealId === dealId),
    );
  }

  uploadDealDocument(dealId: string, payload: DealDocumentPayload): Promise<DealDocument> {
    return this.request(
      `/crm/deals/${dealId}/documents`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const document: DealDocument = {
          id: createRandomId(),
          dealId,
          title: payload.title,
          fileName: payload.fileName,
          fileSize: payload.fileSize,
          uploadedAt: new Date().toISOString(),
          uploadedBy: "Вы",
          url: payload.url,
        };
        dealDocumentsMock.unshift(document);
        return document;
      },
    );
  }

  getDealPayments(dealId: string): Promise<Payment[]> {
    return this.request(`/crm/deals/${dealId}/payments`, undefined, async () =>
      paymentsMock
        .filter((payment) => payment.dealId === dealId)
        .map((payment) => clonePayment(payment)),
    );
  }

  getDealActivity(dealId: string): Promise<ActivityLogEntry[]> {
    return this.request(`/crm/deals/${dealId}/activity`, undefined, async () =>
      activitiesMock.filter((entry) => entry.dealId === dealId),
    );
  }

  updateDeal(dealId: string, payload: UpdateDealPayload): Promise<DealDetailsData> {
    return this.request(
      `/crm/deals/${dealId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const deal = dealsMock.find((item) => item.id === dealId);
        if (!deal) {
          throw new ApiError("Deal not found", 404);
        }

        if (payload.name !== undefined) {
          deal.name = payload.name;
        }
        if (payload.stage !== undefined) {
          deal.stage = payload.stage;
        }
        if (payload.value !== undefined) {
          deal.value = payload.value;
        }
        if (payload.probability !== undefined) {
          deal.probability = payload.probability;
        }
        if (payload.owner !== undefined) {
          deal.owner = payload.owner;
        }

        deal.nextReviewAt = payload.nextReviewAt;

        if (payload.expectedCloseDate !== undefined) {
          deal.expectedCloseDate = payload.expectedCloseDate ?? undefined;
        }

        deal.updatedAt = new Date().toISOString();

        const details = dealDetailsMock[dealId];
        if (details) {
          details.name = deal.name;
          details.stage = deal.stage;
          details.value = deal.value;
          details.probability = deal.probability;
          details.owner = deal.owner;
          details.nextReviewAt = deal.nextReviewAt;
          details.expectedCloseDate = deal.expectedCloseDate;
          details.updatedAt = deal.updatedAt;

          const nextReviewField = details.forms
            .flatMap((group) => group.fields)
            .find((field) => field.id === "nextReviewAt");
          if (nextReviewField) {
            nextReviewField.value = deal.nextReviewAt.slice(0, 10);
          }
        }

        return this.getDealDetails(dealId);
      },
    );
  }

  updateDealStage(dealId: string, stage: DealStage): Promise<Deal> {
    return this.request(
      `/crm/deals/${dealId}/stage`,
      {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      },
      async () => updateDealStageMock(dealId, stage),
    );
  }

  getClients(): Promise<Client[]> {
    return this.request("/crm/clients", undefined, async () => clientsMock);
  }

  getClient(id: string): Promise<Client> {
    return this.request(`/crm/clients/${id}`, undefined, async () => {
      const client = clientsMock.find((item) => item.id === id);
      if (!client) {
        throw new ApiError("Client not found", 404);
      }
      return client;
    });
  }

  updateClientContacts(clientId: string, payload: UpdateClientContactsPayload): Promise<Client> {
    return this.request(
      `/crm/clients/${clientId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const client = clientsMock.find((item) => item.id === clientId);
        if (!client) {
          throw new ApiError("Client not found", 404);
        }

        client.email = payload.email;
        client.phone = payload.phone;

        if (payload.contacts) {
          client.contacts = payload.contacts.map((contact) => ({
            ...contact,
            id: contact.id ?? createRandomId(),
          }));
        }

        client.lastActivityAt = new Date().toISOString();
        return {
          ...client,
          contacts: client.contacts?.map((contact) => ({ ...contact })),
        };
      },
    );
  }

  getClientPolicies(clientId: string, params?: ClientPoliciesQueryParams): Promise<ClientPolicy[]> {
    return this.request(
      `/crm/clients/${clientId}/policies`,
      undefined,
      async () => {
        const normalizedSearch = params?.search?.trim().toLowerCase();
        const statusFilter = params?.status;

        const policies = clientPoliciesMock.filter((policy) => {
          if (policy.clientId !== clientId) {
            return false;
          }

          if (statusFilter === "active" && !isActiveClientPolicyStatus(policy.status)) {
            return false;
          }

          if (statusFilter === "archived" && !isArchivedClientPolicyStatus(policy.status)) {
            return false;
          }

          if (normalizedSearch) {
            const haystack = `${policy.number} ${policy.product} ${policy.insurer}`.toLowerCase();
            return haystack.includes(normalizedSearch);
          }

          return true;
        });

        policies.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        return policies.map((policy) => cloneClientPolicy(policy));
      },
    );
  }

  createClientPolicy(clientId: string, payload: UpsertClientPolicyPayload): Promise<ClientPolicy> {
    return this.request(
      `/crm/clients/${clientId}/policies`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const now = new Date().toISOString();
        const client = clientsMock.find((item) => item.id === clientId);
        if (!client) {
          throw new ApiError("Client not found", 404);
        }

        const managerName = payload.managerName ?? client.owner ?? "Менеджер CRM";
        const managerId = payload.managerId ?? `manager-${clientId}`;

        const policy: ClientPolicy = {
          id: createRandomId(),
          clientId,
          number: payload.number,
          product: payload.product,
          insurer: payload.insurer,
          status: payload.status ?? "draft",
          premium: payload.premium,
          currency: payload.currency,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          createdAt: now,
          updatedAt: now,
          nextPaymentDate: payload.periodStart,
          lastInteractionAt: now,
          manager: {
            id: managerId,
            name: managerName,
            title: payload.managerTitle ?? "Клиентский менеджер",
            email: payload.managerEmail ?? `${managerId}@crm.local`,
            phone: payload.managerPhone ?? client.phone,
          },
          tags: payload.tags ? Array.from(new Set(payload.tags.filter(Boolean))) : undefined,
          coverageSummary: payload.coverageSummary,
          attachmentsCount: 0,
          reminders: [],
        };

        clientPoliciesMock.unshift(policy);
        return cloneClientPolicy(policy);
      },
    );
  }

  updateClientPolicy(policyId: string, payload: Partial<UpsertClientPolicyPayload>): Promise<ClientPolicy> {
    return this.request(
      `/crm/policies/${policyId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const policy = clientPoliciesMock.find((item) => item.id === policyId);
        if (!policy) {
          throw new ApiError("Policy not found", 404);
        }

        if (payload.number !== undefined) {
          policy.number = payload.number;
        }
        if (payload.product !== undefined) {
          policy.product = payload.product;
        }
        if (payload.insurer !== undefined) {
          policy.insurer = payload.insurer;
        }
        if (payload.premium !== undefined) {
          policy.premium = payload.premium;
        }
        if (payload.currency !== undefined) {
          policy.currency = payload.currency;
        }
        if (payload.periodStart !== undefined) {
          policy.periodStart = payload.periodStart;
        }
        if (payload.periodEnd !== undefined) {
          policy.periodEnd = payload.periodEnd;
        }
        if (payload.status !== undefined) {
          policy.status = payload.status;
        }
        if (payload.tags !== undefined) {
          policy.tags = Array.from(new Set(payload.tags.filter(Boolean)));
        }
        if (payload.coverageSummary !== undefined) {
          policy.coverageSummary = payload.coverageSummary ?? undefined;
        }
        if (payload.managerId || payload.managerName || payload.managerTitle || payload.managerEmail || payload.managerPhone) {
          policy.manager = {
            ...policy.manager,
            id: payload.managerId ?? policy.manager.id,
            name: payload.managerName ?? policy.manager.name,
            title: payload.managerTitle ?? policy.manager.title,
            email: payload.managerEmail ?? policy.manager.email,
            phone: payload.managerPhone ?? policy.manager.phone,
          };
        }

        policy.updatedAt = new Date().toISOString();
        policy.lastInteractionAt = policy.updatedAt;

        return cloneClientPolicy(policy);
      },
    );
  }

  getClientTasks(clientId: string): Promise<ClientTaskChecklistItem[]> {
    return this.request(
      `/crm/clients/${clientId}/tasks`,
      undefined,
      async () =>
        clientTaskChecklistMock
          .filter((task) => task.clientId === clientId)
          .map((task) => cloneClientTaskChecklistItem(task)),
    );
  }

  toggleClientTask(taskId: string, completed: boolean): Promise<ClientTaskChecklistItem> {
    return this.request(
      `/crm/client-tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      },
      async () => {
        const task = clientTaskChecklistMock.find((item) => item.id === taskId);
        if (!task) {
          throw new ApiError("Task not found", 404);
        }

        task.completed = completed;
        task.reminderAt = completed ? null : task.reminderAt ?? undefined;
        return cloneClientTaskChecklistItem(task);
      },
    );
  }

  getClientReminders(clientId: string): Promise<ClientReminderCalendarItem[]> {
    return this.request(
      `/crm/clients/${clientId}/reminders`,
      undefined,
      async () =>
        clientRemindersMock
          .filter((reminder) => reminder.clientId === clientId)
          .sort((a, b) => new Date(a.occursAt).getTime() - new Date(b.occursAt).getTime())
          .map((reminder) => cloneClientReminder(reminder)),
    );
  }

  getTasks(): Promise<Task[]> {
    return this.request("/crm/tasks", undefined, async () => tasksMock);
  }

  createTask(payload: CreateTaskPayload): Promise<Task> {
    return this.request(
      "/crm/tasks",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const status = payload.status ?? "new";
        const completed = status === "done";
        const type = payload.type ?? "other";
        const tags = payload.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
        const reminderAt = payload.reminderAt ?? undefined;

        const checklist = payload.checklist?.map((item) => ({ ...item })) ?? [];
        const comments = payload.comments?.map((comment) => ({ ...comment })) ?? [];

        const task: Task = {
          id: createRandomId(),
          title: payload.title,
          dueDate: payload.dueDate,
          status,
          completed,
          owner: payload.owner,
          type,
          tags,
          dealId: payload.dealId ?? undefined,
          clientId: payload.clientId ?? undefined,
          reminderAt,
          description: payload.description,
          checklist,
          comments,
        };

        tasksMock.unshift(task);
        return { ...task };
      },
    );
  }

  async updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
    const changes = sanitizeTaskPatch(payload);

    return this.request(
      `/crm/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify(changes),
      },
      async () => {
        const task = tasksMock.find((item) => item.id === taskId);
        if (!task) {
          throw new ApiError("Task not found", 404);
        }

        applyTaskPatch(task, changes);
        return { ...task };
      },
    );
  }

  getPayments(params?: { include?: Array<"incomes" | "expenses"> }): Promise<Payment[]> {
    return this.request("/crm/payments", undefined, async () => {
      const includeIncomes = params?.include?.includes("incomes");
      const includeExpenses = params?.include?.includes("expenses");

      return paymentsMock.map((payment) => {
        const clone = clonePayment(payment);
        if (!includeIncomes) {
          clone.incomes = [];
        }
        if (!includeExpenses) {
          clone.expenses = [];
        }
        return clone;
      });
    });
  }

  createPayment(payload: PaymentPayload): Promise<Payment> {
    return this.request(
      "/crm/payments",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const now = new Date().toISOString();
        const deal = dealsMock.find((item) => item.id === payload.dealId);
        const client = clientsMock.find((item) => item.id === payload.clientId);
        const siblings = paymentsMock.filter((payment) => payment.policyNumber === payload.policyNumber);
        const nextSequence = siblings.length > 0 ? Math.max(...siblings.map((item) => item.sequence)) + 1 : 1;

        const confirmed = Boolean(payload.actualDate || payload.actualAmount);
        const payment: Payment = {
          id: createRandomId(),
          dealId: payload.dealId,
          dealName: deal?.name,
          clientId: payload.clientId,
          clientName: client?.name,
          policyId: payload.policyId ?? createRandomId(),
          policyNumber: payload.policyNumber,
          sequence: nextSequence,
          amount: payload.plannedAmount,
          plannedAmount: payload.plannedAmount,
          currency: payload.currency,
          status: payload.status ?? (confirmed ? "received" : "planned"),
          confirmationStatus: confirmed ? "confirmed" : "pending",
          actualAmount: payload.actualAmount ?? undefined,
          paidAt: payload.actualDate ?? undefined,
          plannedDate: payload.plannedDate,
          dueDate: payload.plannedDate,
          actualDate: payload.actualDate ?? undefined,
          comment: payload.comment ?? undefined,
          incomesTotal: 0,
          expensesTotal: 0,
          netTotal: 0,
          incomes: [],
          expenses: [],
          createdAt: now,
          updatedAt: now,
          recordedBy: payload.recordedBy ?? undefined,
          recordedByRole: payload.recordedByRole ?? undefined,
          updatedBy: payload.recordedBy ?? undefined,
          history: [],
        };

        paymentsMock.unshift(payment);
        return clonePayment(payment);
      },
    );
  }

  updatePayment(paymentId: string, payload: PaymentUpdatePayload): Promise<Payment> {
    return this.request(
      `/crm/payments/${paymentId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        if (payload.plannedAmount !== undefined) {
          payment.plannedAmount = payload.plannedAmount;
          payment.amount = payload.plannedAmount;
        }

        if (payload.plannedDate !== undefined) {
          payment.plannedDate = payload.plannedDate || undefined;
          payment.dueDate = payload.plannedDate || undefined;
        }

        if (payload.currency !== undefined) {
          payment.currency = payload.currency;
          payment.incomes = payment.incomes.map((income) => ({ ...income, currency: payload.currency! }));
          payment.expenses = payment.expenses.map((expense) => ({ ...expense, currency: payload.currency! }));
        }

        if (payload.status !== undefined) {
          payment.status = payload.status;
        }

        if (payload.comment !== undefined) {
          payment.comment = payload.comment ?? undefined;
        }

        if (payload.actualDate !== undefined) {
          payment.actualDate = payload.actualDate ?? undefined;
          payment.paidAt = payload.actualDate ?? undefined;
        }

        if (payload.actualAmount !== undefined) {
          payment.actualAmount = payload.actualAmount ?? undefined;
        }

        if (payload.recordedBy !== undefined) {
          payment.recordedBy = payload.recordedBy ?? undefined;
        }

        if (payload.recordedByRole !== undefined) {
          payment.recordedByRole = payload.recordedByRole ?? undefined;
        }

        const now = new Date().toISOString();
        payment.updatedAt = now;
        if (payload.recordedBy) {
          payment.updatedBy = payload.recordedBy;
        }

        if (payload.changeReason) {
          payment.history = [
            {
              id: createRandomId(),
              changedAt: now,
              changedBy: payload.recordedBy ?? payment.updatedBy ?? "Система",
              reason: payload.changeReason,
              snapshot: {
                plannedAmount: payment.plannedAmount,
                actualAmount: payment.actualAmount,
                plannedDate: payment.plannedDate,
                actualDate: payment.actualDate,
                status: payment.status,
              },
            },
            ...payment.history,
          ];
        }

        return clonePayment(recalculateTotals(payment));
      },
    );
  }

  confirmPayment(paymentId: string, payload: PaymentConfirmationPayload): Promise<Payment> {
    return this.request(
      `/crm/payments/${paymentId}/confirm`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const now = new Date().toISOString();
        payment.actualAmount = payload.actualAmount;
        payment.actualDate = payload.actualDate;
        payment.paidAt = payload.actualDate;
        payment.recordedBy = payload.recordedBy;
        payment.recordedByRole = payload.recordedByRole ?? payment.recordedByRole;
        if (payload.comment) {
          payment.comment = payload.comment;
        }

        if (payment.status === "planned" || payment.status === "expected") {
          payment.status = "received";
        }

        payment.confirmationStatus = "confirmed";
        payment.updatedAt = now;
        payment.updatedBy = payload.recordedBy;

        payment.history = [
          {
            id: createRandomId(),
            changedAt: now,
            changedBy: payload.recordedBy,
            reason: payload.comment ?? "Платёж подтверждён",
            snapshot: {
              plannedAmount: payment.plannedAmount,
              actualAmount: payment.actualAmount,
              plannedDate: payment.plannedDate,
              actualDate: payment.actualDate,
              status: payment.status,
            },
          },
          ...payment.history,
        ];

        return clonePayment(recalculateTotals(payment));
      },
    );
  }

  revokePaymentConfirmation(paymentId: string, payload: PaymentRevokePayload): Promise<Payment> {
    return this.request(
      `/crm/payments/${paymentId}/revoke-confirmation`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const now = new Date().toISOString();
        payment.confirmationStatus = "pending";
        payment.actualAmount = undefined;
        payment.actualDate = undefined;
        payment.paidAt = undefined;
        payment.recordedBy = undefined;
        payment.recordedByRole = undefined;
        if (payment.status === "received") {
          payment.status = "expected";
        }

        payment.updatedAt = now;
        payment.updatedBy = payload.recordedBy;

        payment.history = [
          {
            id: createRandomId(),
            changedAt: now,
            changedBy: payload.recordedBy,
            reason: payload.reason ?? "Подтверждение отменено",
            snapshot: {
              plannedAmount: payment.plannedAmount,
              actualAmount: payment.actualAmount,
              plannedDate: payment.plannedDate,
              actualDate: payment.actualDate,
              status: payment.status,
            },
          },
          ...payment.history,
        ];

        return clonePayment(recalculateTotals(payment));
      },
    );
  }

  deletePayment(paymentId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}`,
      {
        method: "DELETE",
      },
      async () => {
        const index = paymentsMock.findIndex((item) => item.id === paymentId);
        if (index === -1) {
          throw new ApiError("Payment not found", 404);
        }

        paymentsMock.splice(index, 1);
        return { id: paymentId };
      },
    );
  }

  createPaymentIncome(paymentId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/incomes`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const now = new Date().toISOString();
        const attachments = (payload.attachments ?? []).map((attachment) => ({
          id: attachment.id ?? createRandomId(),
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          uploadedAt: attachment.uploadedAt ?? now,
          uploadedBy: attachment.uploadedBy ?? "Система",
          url: attachment.url,
        }));
        const plannedAmount = payload.plannedAmount ?? 0;
        const actualAmount = payload.actualAmount ?? null;
        const effectiveAmount = actualAmount ?? plannedAmount;
        const category = payload.category ?? "other_income";
        const historyEntry = {
          id: createRandomId(),
          changedAt: now,
          changedBy: "Система",
          plannedAmount,
          actualAmount,
          reason: payload.reason ?? (actualAmount !== null ? "confirmation" : "initial_planning"),
          note: payload.note ?? null,
        } satisfies PaymentEntry["history"][number];

        const income: PaymentEntry = {
          id: createRandomId(),
          paymentId,
          amount: effectiveAmount,
          plannedAmount,
          actualAmount,
          currency: payment.currency,
          category,
          postedAt: payload.plannedPostedAt ?? now,
          actualPostedAt: payload.actualPostedAt ?? null,
          note: payload.note,
          status: actualAmount !== null ? "confirmed" : "pending_confirmation",
          adjustmentReason: payload.reason ?? null,
          attachments,
          history: [historyEntry],
          createdAt: now,
          updatedAt: now,
          createdBy: "Система",
          updatedBy: "Система",
        };

        payment.incomes.unshift(income);
        payment.updatedAt = now;
        recalculateTotals(payment);

        return { ...income, attachments: income.attachments.map((item) => ({ ...item })), history: income.history.map((item) => ({ ...item })) };
      },
    );
  }

  updatePaymentIncome(paymentId: string, incomeId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/incomes/${incomeId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const income = payment.incomes.find((item) => item.id === incomeId);
        if (!income) {
          throw new ApiError("Income not found", 404);
        }

        if (!income.attachments) {
          income.attachments = [];
        }
        if (!income.history) {
          income.history = [];
        }

        const now = new Date().toISOString();

        let hasMeaningfulChange = false;

        if (payload.category !== undefined) {
          income.category = payload.category;
          hasMeaningfulChange = true;
        }
        if (payload.plannedAmount !== undefined) {
          income.plannedAmount = payload.plannedAmount;
          hasMeaningfulChange = true;
        }
        if (payload.plannedPostedAt !== undefined) {
          income.postedAt = payload.plannedPostedAt;
          hasMeaningfulChange = true;
        }
        if (payload.note !== undefined) {
          income.note = payload.note ?? undefined;
          hasMeaningfulChange = true;
        }
        if (payload.actualAmount !== undefined) {
          income.actualAmount = payload.actualAmount;
          hasMeaningfulChange = true;
        }
        if (payload.actualPostedAt !== undefined) {
          income.actualPostedAt = payload.actualPostedAt;
          hasMeaningfulChange = true;
        }
        if (payload.reason !== undefined) {
          income.adjustmentReason = payload.reason;
          hasMeaningfulChange = true;
        }

        if (payload.attachments && payload.attachments.length > 0) {
          const attachments = payload.attachments.map((attachment) => ({
            id: attachment.id ?? createRandomId(),
            fileName: attachment.fileName,
            fileSize: attachment.fileSize,
            uploadedAt: attachment.uploadedAt ?? now,
            uploadedBy: attachment.uploadedBy ?? "Система",
            url: attachment.url,
          }));
          income.attachments.push(...attachments);
          hasMeaningfulChange = true;
        }

        income.amount = (income.actualAmount ?? income.plannedAmount) ?? income.amount;
        income.status = income.actualAmount !== undefined && income.actualAmount !== null ? "confirmed" : "pending_confirmation";

        if (hasMeaningfulChange) {
          income.history.unshift({
            id: createRandomId(),
            changedAt: now,
            changedBy: "Система",
            plannedAmount: income.plannedAmount,
            actualAmount: income.actualAmount ?? null,
            reason: income.adjustmentReason ?? null,
            note: income.note ?? null,
          });
        }

        income.updatedAt = now;
        payment.updatedAt = now;
        recalculateTotals(payment);

        return {
          ...income,
          attachments: income.attachments.map((item) => ({ ...item })),
          history: income.history.map((item) => ({ ...item })),
        };
      },
    );
  }

  deletePaymentIncome(paymentId: string, incomeId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}/incomes/${incomeId}`,
      {
        method: "DELETE",
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const index = payment.incomes.findIndex((item) => item.id === incomeId);
        if (index === -1) {
          throw new ApiError("Income not found", 404);
        }

        payment.incomes.splice(index, 1);
        payment.updatedAt = new Date().toISOString();
        recalculateTotals(payment);

        return { id: incomeId };
      },
    );
  }

  createPaymentExpense(paymentId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/expenses`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const now = new Date().toISOString();
        const attachments = (payload.attachments ?? []).map((attachment) => ({
          id: attachment.id ?? createRandomId(),
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          uploadedAt: attachment.uploadedAt ?? now,
          uploadedBy: attachment.uploadedBy ?? "Система",
          url: attachment.url,
        }));
        const plannedAmount = payload.plannedAmount ?? 0;
        const actualAmount = payload.actualAmount ?? null;
        const effectiveAmount = actualAmount ?? plannedAmount;
        const category = payload.category ?? "other_expense";
        const historyEntry = {
          id: createRandomId(),
          changedAt: now,
          changedBy: "Система",
          plannedAmount,
          actualAmount,
          reason: payload.reason ?? (actualAmount !== null ? "confirmation" : "initial_planning"),
          note: payload.note ?? null,
        } satisfies PaymentEntry["history"][number];

        const expense: PaymentEntry = {
          id: createRandomId(),
          paymentId,
          amount: effectiveAmount,
          plannedAmount,
          actualAmount,
          currency: payment.currency,
          category,
          postedAt: payload.plannedPostedAt ?? now,
          actualPostedAt: payload.actualPostedAt ?? null,
          note: payload.note,
          status: actualAmount !== null ? "confirmed" : "pending_confirmation",
          adjustmentReason: payload.reason ?? null,
          attachments,
          history: [historyEntry],
          createdAt: now,
          updatedAt: now,
          createdBy: "Система",
          updatedBy: "Система",
        };

        payment.expenses.unshift(expense);
        payment.updatedAt = now;
        recalculateTotals(payment);

        return { ...expense, attachments: expense.attachments.map((item) => ({ ...item })), history: expense.history.map((item) => ({ ...item })) };
      },
    );
  }

  updatePaymentExpense(paymentId: string, expenseId: string, payload: PaymentEntryPayload): Promise<PaymentEntry> {
    return this.request(
      `/crm/payments/${paymentId}/expenses/${expenseId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const expense = payment.expenses.find((item) => item.id === expenseId);
        if (!expense) {
          throw new ApiError("Expense not found", 404);
        }

        if (!expense.attachments) {
          expense.attachments = [];
        }
        if (!expense.history) {
          expense.history = [];
        }

        const now = new Date().toISOString();
        let hasMeaningfulChange = false;

        if (payload.category !== undefined) {
          expense.category = payload.category;
          hasMeaningfulChange = true;
        }
        if (payload.plannedAmount !== undefined) {
          expense.plannedAmount = payload.plannedAmount;
          hasMeaningfulChange = true;
        }
        if (payload.plannedPostedAt !== undefined) {
          expense.postedAt = payload.plannedPostedAt;
          hasMeaningfulChange = true;
        }
        if (payload.note !== undefined) {
          expense.note = payload.note ?? undefined;
          hasMeaningfulChange = true;
        }
        if (payload.actualAmount !== undefined) {
          expense.actualAmount = payload.actualAmount;
          hasMeaningfulChange = true;
        }
        if (payload.actualPostedAt !== undefined) {
          expense.actualPostedAt = payload.actualPostedAt;
          hasMeaningfulChange = true;
        }
        if (payload.reason !== undefined) {
          expense.adjustmentReason = payload.reason;
          hasMeaningfulChange = true;
        }

        if (payload.attachments && payload.attachments.length > 0) {
          const attachments = payload.attachments.map((attachment) => ({
            id: attachment.id ?? createRandomId(),
            fileName: attachment.fileName,
            fileSize: attachment.fileSize,
            uploadedAt: attachment.uploadedAt ?? now,
            uploadedBy: attachment.uploadedBy ?? "Система",
            url: attachment.url,
          }));
          expense.attachments.push(...attachments);
          hasMeaningfulChange = true;
        }

        expense.amount = (expense.actualAmount ?? expense.plannedAmount) ?? expense.amount;
        expense.status = expense.actualAmount !== undefined && expense.actualAmount !== null ? "confirmed" : "pending_confirmation";

        if (hasMeaningfulChange) {
          expense.history.unshift({
            id: createRandomId(),
            changedAt: now,
            changedBy: "Система",
            plannedAmount: expense.plannedAmount,
            actualAmount: expense.actualAmount ?? null,
            reason: expense.adjustmentReason ?? null,
            note: expense.note ?? null,
          });
        }

        expense.updatedAt = now;
        payment.updatedAt = now;
        recalculateTotals(payment);

        return {
          ...expense,
          attachments: expense.attachments.map((item) => ({ ...item })),
          history: expense.history.map((item) => ({ ...item })),
        };
      },
    );
  }

  deletePaymentExpense(paymentId: string, expenseId: string): Promise<{ id: string }> {
    return this.request(
      `/crm/payments/${paymentId}/expenses/${expenseId}`,
      {
        method: "DELETE",
      },
      async () => {
        const payment = paymentsMock.find((item) => item.id === paymentId);
        if (!payment) {
          throw new ApiError("Payment not found", 404);
        }

        const index = payment.expenses.findIndex((item) => item.id === expenseId);
        if (index === -1) {
          throw new ApiError("Expense not found", 404);
        }

        payment.expenses.splice(index, 1);
        payment.updatedAt = new Date().toISOString();
        recalculateTotals(payment);

        return { id: expenseId };
      },
    );
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
      },
      async () => {
        const updated: Task[] = [];

        for (const taskId of taskIds) {
          const task = tasksMock.find((item) => item.id === taskId);
          if (!task) {
            continue;
          }

          const patch: UpdateTaskPayload = { ...changes };

          if (options?.shiftDueDateByDays) {
            const dueDate = new Date(task.dueDate);
            dueDate.setDate(dueDate.getDate() + options.shiftDueDateByDays);
            patch.dueDate = dueDate.toISOString();
          }

          applyTaskPatch(task, patch);
          updated.push({ ...task });
        }

        if (updated.length === 0) {
          throw new ApiError("Tasks not found", 404);
        }

        return updated;
      },
    );
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.updateTask(taskId, { status, completed: status === "done" });
  }

  getClientActivities(
    clientId: string,
    params?: ClientActivityQueryParams,
  ): Promise<PaginatedResult<ActivityLogEntry>> {
    return this.request(`/crm/clients/${clientId}/activity`, undefined, async () => {
      const pageSize = Math.max(1, params?.pageSize ?? 5);
      const page = Math.max(1, params?.page ?? 1);
      const typeFilter = params?.type && params.type !== "all" ? params.type : undefined;

      let entries = activitiesMock.filter((entry) => entry.clientId === clientId);

      if (typeFilter) {
        entries = entries.filter((entry) => entry.type === typeFilter);
      }

      entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = entries.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const items = entries.slice(start, end).map((entry) => ({ ...entry }));

      return {
        items,
        total,
        page,
        pageSize,
      };
    });
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

const ACTIVE_CLIENT_POLICY_STATUSES: ClientPolicyStatus[] = ["draft", "pending", "active", "expiring"];
const ARCHIVED_CLIENT_POLICY_STATUSES: ClientPolicyStatus[] = ["archived", "cancelled", "expired"];

function isActiveClientPolicyStatus(status: ClientPolicyStatus) {
  return ACTIVE_CLIENT_POLICY_STATUSES.includes(status);
}

export function isArchivedClientPolicyStatus(status: ClientPolicyStatus) {
  return ARCHIVED_CLIENT_POLICY_STATUSES.includes(status);
}

function cloneClientPolicy(policy: ClientPolicy): ClientPolicy {
  return {
    ...policy,
    manager: { ...policy.manager },
    tags: policy.tags ? [...policy.tags] : undefined,
    reminders: policy.reminders ? policy.reminders.map((reminder) => ({ ...reminder })) : undefined,
  };
}

function cloneClientTaskChecklistItem(task: ClientTaskChecklistItem): ClientTaskChecklistItem {
  return { ...task };
}

function cloneClientReminder(reminder: ClientReminderCalendarItem): ClientReminderCalendarItem {
  return { ...reminder };
}

function clonePaymentEntry(entry: PaymentEntry): PaymentEntry {
  const attachments = entry.attachments.map((attachment) => ({ ...attachment }));
  const history = entry.history.map((record) => ({ ...record }));

  return {
    ...entry,
    attachments,
    history,
  };
}

function clonePayment(payment: Payment): Payment {
  return {
    ...payment,
    incomes: payment.incomes.map((income) => clonePaymentEntry(income)),
    expenses: payment.expenses.map((expense) => clonePaymentEntry(expense)),
    history: payment.history.map((change) => ({
      ...change,
      snapshot: { ...change.snapshot },
    })),
  };
}

function recalculateTotals(payment: Payment): Payment {
  for (const income of payment.incomes) {
    income.amount = (income.actualAmount ?? income.plannedAmount ?? income.amount) ?? 0;
  }

  for (const expense of payment.expenses) {
    expense.amount = (expense.actualAmount ?? expense.plannedAmount ?? expense.amount) ?? 0;
  }

  const incomesTotal = payment.incomes.reduce((sum, income) => sum + income.amount, 0);
  const expensesTotal = payment.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  payment.incomesTotal = incomesTotal;
  payment.expensesTotal = expensesTotal;
  payment.netTotal = incomesTotal - expensesTotal;
  payment.amount = payment.plannedAmount;
  return payment;
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

const DAY_IN_MS = 86_400_000;

const DEAL_STAGE_ORDER: DealStage[] = [
  "qualification",
  "negotiation",
  "proposal",
  "closedWon",
  "closedLost",
];

function getPeriodStart(period: DealPeriodFilter | undefined): number | undefined {
  switch (period) {
    case "7d":
      return Date.now() - DAY_IN_MS * 7;
    case "30d":
      return Date.now() - DAY_IN_MS * 30;
    case "90d":
      return Date.now() - DAY_IN_MS * 90;
    default:
      return undefined;
  }
}

function filterDealsMock(deals: Deal[], filters?: DealFilters): Deal[] {
  const managerNames = new Set<string>();
  const includeNoManager = (filters?.managers ?? []).some((manager) => manager === NO_MANAGER_VALUE);

  for (const manager of filters?.managers ?? []) {
    if (!manager || manager === NO_MANAGER_VALUE) {
      continue;
    }

    managerNames.add(manager.toLowerCase());
  }
  const search = filters?.search?.trim().toLowerCase();
  const periodStart = getPeriodStart(filters?.period);
  const stageFilter = filters?.stage && filters.stage !== "all" ? filters.stage : undefined;

  return deals
    .map((deal, index) => ({ deal, index }))
    .filter(({ deal }) => {
      if (stageFilter && deal.stage !== stageFilter) {
        return false;
      }

      const hasManagerFilter = includeNoManager || managerNames.size > 0;

      if (hasManagerFilter) {
        const owner = deal.owner?.trim();

        if (!owner) {
          return includeNoManager;
        }

        if (managerNames.size > 0 && !managerNames.has(owner.toLowerCase())) {
          return false;
        }

      }

      if (periodStart && new Date(deal.updatedAt).getTime() < periodStart) {
        return false;
      }

      if (search) {
        const haystack = `${deal.name} ${deal.clientName}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    })
    .map(({ deal, index }) => ({ deal: { ...deal }, index }))
    .sort((a, b) => {
      const diff = compareDealsByNextReview(a.deal, b.deal);
      if (diff !== 0) {
        return diff;
      }

      return a.index - b.index;
    })
    .map((entry) => entry.deal);
}

function updateDealStageMock(dealId: string, stage: DealStage): Deal {
  const deal = dealsMock.find((item) => item.id === dealId);

  if (!deal) {
    throw new ApiError("Deal not found", 404);
  }

  deal.stage = stage;
  deal.updatedAt = new Date().toISOString();

  const details = dealDetailsMock[dealId];
  if (details) {
    details.stage = stage;
    details.updatedAt = deal.updatedAt;
  }

  return { ...deal };
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

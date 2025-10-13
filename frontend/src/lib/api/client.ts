import {
  activitiesMock,
  clientsMock,
  dealDocumentsMock,
  dealNotesMock,
  dealsMock,
  paymentsMock,
  tasksMock,
} from "@/mocks/data";
import {
  ActivityLogEntry,
  Client,
  Deal,
  DealDocument,
  DealNote,
  DealStageMetrics,
  Payment,
  Task,
} from "@/types/crm";
import { createRandomId } from "@/lib/utils/id";

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

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

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
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

export interface UpdateDealPayload {
  name?: string;
  stage?: Deal["stage"];
  value?: number;
  probability?: number;
  expectedCloseDate?: string | null;
  owner?: string;
}

export class ApiClient {
  constructor(private readonly config: ApiClientConfig = {}) {}

  private get baseUrl() {
    return this.config.baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  private get timeoutMs(): number {
    return normalizeTimeout(this.config.timeoutMs) ?? ENV_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
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
        signal: mergeAbortSignals([timeoutController?.signal, init?.signal]),
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
        params.append("manager", manager);
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

  getDeals(filters?: DealFilters): Promise<Deal[]> {
    const query = this.buildQueryString(filters);
    return this.request(`/crm/deals${query}`, undefined, async () => filterDealsMock(dealsMock, filters));
  }

  getDealStageMetrics(filters?: DealFilters): Promise<DealStageMetrics[]> {
    const query = this.buildQueryString(filters);
    return this.request(
      `/crm/deals/stage-metrics${query}`,
      undefined,
      async () => calculateStageMetrics(filterDealsMock(dealsMock, filters)),
    );
  }

  getDeal(id: string): Promise<Deal> {
    return this.request(`/crm/deals/${id}`, undefined, async () => {
      const deal = dealsMock.find((item) => item.id === id);
      if (!deal) {
        throw new ApiError("Deal not found", 404);
      }

      const tasks = tasksMock.filter((item) => item.dealId === id);
      const notes = dealNotesMock.filter((item) => item.dealId === id);
      const documents = dealDocumentsMock.filter((item) => item.dealId === id);
      const payments = paymentsMock.filter((item) => item.dealId === id);
      const activity = activitiesMock.filter((item) => item.dealId === id);

      return {
        ...deal,
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
          completed: false,
          owner: payload.owner ?? deal?.owner ?? "",
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
      paymentsMock.filter((payment) => payment.dealId === dealId),
    );
  }

  getDealActivity(dealId: string): Promise<ActivityLogEntry[]> {
    return this.request(`/crm/deals/${dealId}/activity`, undefined, async () =>
      activitiesMock.filter((entry) => entry.dealId === dealId),
    );
  }

  updateDeal(dealId: string, payload: UpdateDealPayload): Promise<Deal> {
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

        if (payload.expectedCloseDate !== undefined) {
          deal.expectedCloseDate = payload.expectedCloseDate ?? undefined;
        }

        deal.updatedAt = new Date().toISOString();

        return this.getDeal(dealId);
      },
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

  getTasks(): Promise<Task[]> {
    return this.request("/crm/tasks", undefined, async () => tasksMock);
  }

  async updateTaskStatus(taskId: string, completed: boolean): Promise<Task> {
    return this.request(
      `/crm/tasks/${taskId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      },
      async () => {
        const task = tasksMock.find((item) => item.id === taskId);
        if (!task) {
          throw new ApiError("Task not found", 404);
        }
        task.completed = completed;
        return task;
      },
    );
  }

  getPayments(): Promise<Payment[]> {
    return this.request("/crm/payments", undefined, async () => paymentsMock);
  }

  getClientActivities(clientId: string): Promise<ActivityLogEntry[]> {
    return this.request(`/crm/clients/${clientId}/activity`, undefined, async () =>
      activitiesMock.filter((entry) => entry.clientId === clientId),
    );
  }
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
  const normalizedManagers = filters?.managers?.map((name) => name.toLowerCase());
  const search = filters?.search?.trim().toLowerCase();
  const periodStart = getPeriodStart(filters?.period);
  const stageFilter = filters?.stage && filters.stage !== "all" ? filters.stage : undefined;

  return deals
    .filter((deal) => {
      if (stageFilter && deal.stage !== stageFilter) {
        return false;
      }

      if (normalizedManagers && normalizedManagers.length > 0) {
        if (!normalizedManagers.includes(deal.owner.toLowerCase())) {
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
    .map((deal) => ({ ...deal }));
}

function calculateStageMetrics(deals: Deal[]): DealStageMetrics[] {
  const baselineCount = deals.filter((deal) => deal.stage === "qualification").length;
  const now = Date.now();

  return DEAL_STAGE_ORDER.map((stage, index) => {
    const stageDeals = deals.filter((deal) => deal.stage === stage);
    const count = stageDeals.length;
    const totalValue = stageDeals.reduce((acc, deal) => acc + deal.value, 0);
    const conversionRate =
      index === 0
        ? 1
        : baselineCount > 0
          ? Math.max(0, Math.min(1, count / baselineCount))
          : 0;
    const avgCycleDurationDays =
      stageDeals.length === 0
        ? null
        : Number.parseFloat(
            (
              stageDeals.reduce((acc, deal) => acc + (now - new Date(deal.updatedAt).getTime()), 0) /
              stageDeals.length /
              DAY_IN_MS
            ).toFixed(1),
          );

    return {
      stage,
      count,
      totalValue,
      conversionRate,
      avgCycleDurationDays,
    } satisfies DealStageMetrics;
  });
}

function updateDealStageMock(dealId: string, stage: DealStage): Deal {
  const deal = dealsMock.find((item) => item.id === dealId);

  if (!deal) {
    throw new ApiError("Deal not found", 404);
  }

  deal.stage = stage;
  deal.updatedAt = new Date().toISOString();

  return { ...deal };
}

export const apiClient = new ApiClient();

export function createApiClient(config: ApiClientConfig = {}) {
  return new ApiClient(config);
}

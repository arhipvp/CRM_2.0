import { activitiesMock, clientsMock, dealsMock, paymentsMock, tasksMock } from "@/mocks/data";
import { ActivityLogEntry, Client, Deal, Payment, Task } from "@/types/crm";

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

  getDeals(): Promise<Deal[]> {
    return this.request("/crm/deals", undefined, async () => dealsMock);
  }

  getDeal(id: string): Promise<Deal> {
    return this.request(`/crm/deals/${id}`, undefined, async () => {
      const deal = dealsMock.find((item) => item.id === id);
      if (!deal) {
        throw new ApiError("Deal not found", 404);
      }
      return deal;
    });
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

export const apiClient = new ApiClient();

export function createApiClient(config: ApiClientConfig = {}) {
  return new ApiClient(config);
}

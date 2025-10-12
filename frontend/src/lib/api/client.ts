import { activitiesMock, clientsMock, dealsMock, paymentsMock, tasksMock } from "@/mocks/data";
import { ActivityLogEntry, Client, Deal, Payment, Task } from "@/types/crm";

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
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

  private async request<T>(path: string, init?: RequestInit, fallback?: () => T | Promise<T>): Promise<T> {
    const url = this.baseUrl ? new URL(path, this.baseUrl).toString() : undefined;

    if (!url) {
      if (fallback) {
        return await fallback();
      }
      throw new ApiError("API base URL is not configured");
    }

    const response = await fetch(url, {
      ...init,
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

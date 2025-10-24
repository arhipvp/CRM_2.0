import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { sortDealsByNextReview, compareDealsByNextReview } from "@/lib/utils/deals";
import { NO_MANAGER_VALUE } from "@/lib/utils/managers";
import {
  dealsFixture,
  stageMetricsFixture,
} from "../../../../tests/fixtures/api-data";

const API_BASE_URL = "https://api.test.local/api/v1";

const server = setupServer();

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const originalProxyTimeout = process.env.FRONTEND_PROXY_TIMEOUT;
const originalServerTimeout = process.env.FRONTEND_SERVER_TIMEOUT_MS;

async function importClient() {
  return await import("../client");
}

describe("ApiClient при работе с HTTP API", () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE_URL;
  });

  afterEach(() => {
    server.resetHandlers();
    process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
    process.env.FRONTEND_PROXY_TIMEOUT = originalProxyTimeout;
    process.env.FRONTEND_SERVER_TIMEOUT_MS = originalServerTimeout;
    vi.useRealTimers();
  });

  it("запрашивает сделки из API и сортирует их", async () => {
    const apiResponse = [dealsFixture[2], dealsFixture[0], dealsFixture[1]];
    let requestCount = 0;

    server.use(
      http.get(`${API_BASE_URL}/crm/deals`, () => {
        requestCount += 1;
        return HttpResponse.json(apiResponse);
      }),
    );

    const { apiClient } = await importClient();
    const deals = await apiClient.getDeals();

    expect(requestCount).toBe(1);
    expect(deals.map((deal) => deal.id)).toEqual(sortDealsByNextReview(apiResponse).map((deal) => deal.id));
  });

  it("корректно объединяет относительный базовый путь и конечный маршрут", async () => {
    const previousBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      const { createApiClient } = await importClient();
      const client = createApiClient({ baseUrl: "/api" });

      await client.getDeals();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [firstRequestUrl] = fetchSpy.mock.calls[0];
      const [secondRequestUrl] = fetchSpy.mock.calls[1];
      expect(firstRequestUrl).toBe("/api/crm/deals");
      expect(secondRequestUrl).toBe("/api/crm/clients");
    } finally {
      fetchSpy.mockRestore();
      process.env.NEXT_PUBLIC_API_BASE_URL = previousBaseUrl;
    }
  });

  it("передает фильтры в запросе метрик стадий", async () => {
    let requestedUrl: URL | undefined;

    server.use(
      http.get(`${API_BASE_URL}/crm/deals/stage-metrics`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json(stageMetricsFixture);
      }),
    );

    const { apiClient } = await importClient();
    const metrics = await apiClient.getDealStageMetrics({ stage: "closedWon" });

    expect(metrics).toHaveLength(5);
    const closedWonMetrics = metrics.find((item) => item.stage === "closedWon");
    expect(closedWonMetrics).toBeDefined();
    expect(closedWonMetrics?.count ?? 0).toBeGreaterThan(0);
    expect(
      metrics
        .filter((item) => item.stage !== "closedWon")
        .every((item) => item.count === 0),
    ).toBe(true);
    expect(requestedUrl?.pathname).toBe("/api/v1/crm/deals/stage-metrics");
  });

  it("пробрасывает ApiError при ошибке формирования URL", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:9999";
    const { createApiClient, ApiError: ApiErrorCtor } = await importClient();
    const client = createApiClient({ baseUrl: "http://[" });

    await expect(client.getDeals()).rejects.toBeInstanceOf(ApiErrorCtor);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("пробрасывает ApiError при сетевой ошибке", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { apiClient, ApiError: ApiErrorCtor } = await importClient();

    await expect(apiClient.getDeals()).rejects.toBeInstanceOf(ApiErrorCtor);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("пробрасывает ApiError при ответе 5xx", async () => {
    server.use(
      http.get(`${API_BASE_URL}/crm/deals`, () =>
        HttpResponse.json({ message: "Server error" }, { status: 502, statusText: "Bad Gateway" }),
      ),
    );

    const { apiClient, ApiError: ApiErrorCtor } = await importClient();

    await expect(apiClient.getDeals()).rejects.toBeInstanceOf(ApiErrorCtor);
  });

  it("пробрасывает ApiError после досрочного серверного таймаута", async () => {
    vi.useFakeTimers();
    process.env.FRONTEND_SERVER_TIMEOUT_MS = "25";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        setTimeout(() => {
          reject(new DOMException("Request aborted", "AbortError"));
        }, 10);
      });
    });

    try {
      const { apiClient, ApiError: ApiErrorCtor } = await importClient();

      const handled = apiClient.getDeals().catch((error) => error);
      await vi.advanceTimersByTimeAsync(25);

      await expect(handled).resolves.toBeInstanceOf(ApiErrorCtor);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { sortDealsByNextReview, compareDealsByNextReview } from "@/lib/utils/deals";
import { NO_MANAGER_VALUE } from "@/lib/utils/managers";
import {
  dealsFixture,
  stageMetricsFixture,
} from "../../../../tests/fixtures/api-data";

const API_BASE_URL = "https://api.test.local";

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

  it("передает фильтры в запросе метрик стадий", async () => {
    let requestedUrl: URL | undefined;

    server.use(
      http.get(`${API_BASE_URL}/crm/deals/stage-metrics`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json(stageMetricsFixture);
      }),
    );

    const { apiClient } = await importClient();
    const metrics = await apiClient.getDealStageMetrics({
      stage: "closedWon",
      period: "30d",
      managers: ["manager-ivanov", NO_MANAGER_VALUE],
      search: "Ромашка",
    });

    expect(metrics).toEqual(stageMetricsFixture);
    expect(requestedUrl?.searchParams.get("stage")).toBe("closedWon");
    expect(requestedUrl?.searchParams.get("period")).toBe("30d");
    expect(requestedUrl?.searchParams.getAll("manager")).toEqual(["manager-ivanov", NO_MANAGER_VALUE]);
    expect(requestedUrl?.searchParams.get("search")).toBe("Ромашка");
  });

  it("использует fallback при сетевой ошибке", async () => {
    server.use(
      http.get(`${API_BASE_URL}/crm/deals`, () => {
        return HttpResponse.error();
      }),
    );

    const { apiClient } = await importClient();
    const deals = await apiClient.getDeals();

    expect(deals.length).toBeGreaterThan(0);
    for (let index = 1; index < deals.length; index += 1) {
      expect(compareDealsByNextReview(deals[index - 1], deals[index])).toBeLessThanOrEqual(0);
    }
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

  it("переходит на fallback после досрочного серверного таймаута", async () => {
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
      const { apiClient } = await importClient();
      const promise = apiClient.getDeals();

      await vi.advanceTimersByTimeAsync(25);

      const deals = await promise;
      expect(deals.length).toBeGreaterThan(0);
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

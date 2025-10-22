import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomePage SSR", () => {
  it("не прерывает SSR при ApiError от /crm/deal-stage-metrics", async () => {
    vi.mock("@/components/home/HomeOverview", () => ({
      HomeOverview: () => null,
    }));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const clientModule = await import("@/lib/api/client");
    const metricsError = new clientModule.ApiError("Internal Server Error", 500);
    vi.spyOn(clientModule, "getServerApiClient").mockReturnValue(new clientModule.ApiClient());

    const { QueryClient } = await import("@tanstack/react-query");
    const prefetchSpy = vi
      .spyOn(QueryClient.prototype, "prefetchQuery")
      .mockImplementationOnce(() => Promise.reject(metricsError));

    const { default: HomePage } = await import("@/app/page");

    await expect(HomePage()).resolves.toBeTruthy();

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("deal-stage-metrics"), metricsError);
  });
});

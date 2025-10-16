import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomePage SSR", () => {
  it("не прерывает SSR при ApiError от /crm/deals", async () => {
    vi.mock("@/components/deals/HomeDealFunnelBoard", () => ({
      HomeDealFunnelBoard: () => null,
    }));
    vi.mock("@/components/tasks/TaskList", () => ({
      TaskList: () => null,
    }));

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const clientModule = await import("@/lib/api/client");
    const dealsError = new clientModule.ApiError("Internal Server Error", 500);
    vi.spyOn(clientModule, "getServerApiClient").mockReturnValue(new clientModule.ApiClient());

    const { QueryClient } = await import("@tanstack/react-query");
    const prefetchSpy = vi
      .spyOn(QueryClient.prototype, "prefetchQuery")
      .mockImplementationOnce(() => Promise.reject(dealsError))
      .mockImplementationOnce(() => Promise.resolve(undefined));

    const { default: HomePage } = await import("@/app/page");

    await expect(HomePage()).resolves.toBeTruthy();

    expect(prefetchSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("deals"), dealsError);
  });
});

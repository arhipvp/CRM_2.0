import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DealsPage SSR", () => {
  it("не выполняет серверный префетч и рендерит только макет", async () => {
    vi.mock("@/components/deals/DealFunnelHeader", () => ({
      DealFunnelHeader: () => null,
    }));
    vi.mock("@/components/deals/DealFunnelBoard", () => ({
      DealFunnelBoard: () => null,
    }));
    vi.mock("@/components/deals/DealFunnelTable", () => ({
      DealFunnelTable: () => null,
    }));

    vi.mock("@tanstack/react-query", () => {
      throw new Error("DealsPage не должен импортировать QueryClient на сервере");
    });

    const { default: DealsPage } = await import("@/app/deals/page");

    const result = DealsPage();

    expect(result).toBeTruthy();
    expect(result).not.toBeInstanceOf(Promise);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

type ClientModule = typeof import("@/lib/api/client");
const mockGetServerApiClient = vi.fn();
const mockDealDetailsQueryOptions = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/lib/api/client", async () => ({
  ...(await vi.importActual<ClientModule>("@/lib/api/client")),
  getServerApiClient: mockGetServerApiClient,
}));

vi.mock("@/lib/api/queries", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api/queries")>("@/lib/api/queries")),
  dealDetailsQueryOptions: mockDealDetailsQueryOptions,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("DealPage SSR", () => {
  it("возвращает 404 при отсутствии сделки", async () => {
    const { ApiError } = await vi.importActual<ClientModule>("@/lib/api/client");
    const rejection = new ApiError("Deal not found", 404);

    mockGetServerApiClient.mockReturnValue({});

    const queryFn = vi.fn(async () => {
      throw rejection;
    });

    mockDealDetailsQueryOptions.mockReturnValue({
      queryKey: ["deal", "123", "details"] as const,
      queryFn,
      enabled: true,
    });

    const { default: DealPage } = await import("@/app/deals/[dealId]/page");

    await expect(
      DealPage({ params: Promise.resolve({ dealId: "123" }) } as never),
    ).rejects.toThrowError("NEXT_NOT_FOUND");

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});

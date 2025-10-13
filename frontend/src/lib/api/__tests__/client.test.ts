import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

let fetchMock: ReturnType<typeof vi.fn>;

async function importClient() {
  return await import("../client");
}

async function importMocks() {
  return await import("@/mocks/data");
}

describe("ApiClient mock mode", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_BASE_URL = "mock";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
    vi.restoreAllMocks();
  });

  it("возвращает мок-данные при NEXT_PUBLIC_API_BASE_URL=mock", async () => {
    const { apiClient } = await importClient();
    const {
      activitiesMock,
      clientsMock,
      dealsMock,
      paymentsMock,
      tasksMock,
      dealNotesMock,
      dealDocumentsMock,
    } = await importMocks();
    const dealId = dealsMock[0]?.id ?? "";
    const clientId = clientsMock[0]?.id ?? "";

    await expect(apiClient.getDeals()).resolves.toEqual(dealsMock);

    const deal = await apiClient.getDeal(dealId);
    expect(deal).toMatchObject({
      ...dealsMock[0],
      tasks: tasksMock.filter((task) => task.dealId === dealId),
      notes: dealNotesMock.filter((note) => note.dealId === dealId),
      documents: dealDocumentsMock.filter((doc) => doc.dealId === dealId),
      payments: paymentsMock.filter((payment) => payment.dealId === dealId),
      activity: activitiesMock.filter((entry) => entry.dealId === dealId),
    });
    await expect(apiClient.getClients()).resolves.toEqual(clientsMock);
    await expect(apiClient.getClient(clientId)).resolves.toEqual(clientsMock[0]);
    await expect(apiClient.getTasks()).resolves.toEqual(tasksMock);
    await expect(apiClient.getPayments()).resolves.toEqual(paymentsMock);
    await expect(apiClient.getClientActivities(clientId)).resolves.toEqual(
      activitiesMock.filter((entry) => entry.clientId === clientId),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("использует fallback при ошибке формирования URL", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:9999";
    const { createApiClient } = await importClient();
    const { dealsMock } = await importMocks();
    const client = createApiClient({ baseUrl: "http://[" });

    await expect(client.getDeals()).resolves.toEqual(dealsMock);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("использует fallback при сетевой ошибке", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { apiClient } = await importClient();
    const { dealsMock } = await importMocks();

    await expect(apiClient.getDeals()).resolves.toEqual(dealsMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("пробрасывает ApiError при ответе 5xx", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    fetchMock.mockResolvedValue(
      new Response("Server error", {
        status: 502,
        statusText: "Bad Gateway",
      }),
    );
    const { apiClient, ApiError: ApiErrorCtor } = await importClient();

    await expect(apiClient.getDeals()).rejects.toBeInstanceOf(ApiErrorCtor);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sortDealsByNextReview } from "@/lib/utils/deals";

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
      clientPoliciesMock,
      clientRemindersMock,
      clientTaskChecklistMock,
      dealsMock,
      paymentsMock,
      tasksMock,
      dealNotesMock,
      dealDocumentsMock,
    } = await importMocks();

    const dealId = dealsMock[0]?.id;
    const clientId = clientsMock[0]?.id;

    expect(await apiClient.getDeals()).toEqual(sortDealsByNextReview(dealsMock));

    expect(dealId).toBeDefined();
    expect(clientId).toBeDefined();
    if (!dealId || !clientId) {
      throw new Error("Тестовые данные сделок или клиентов не заданы");
    }

    const details = await apiClient.getDealDetails(dealId);
    expect(details).toMatchObject({
      id: dealId,
      name: dealsMock[0]?.name,
      value: dealsMock[0]?.value,
      overview: expect.objectContaining({ metrics: expect.any(Array) }),
      documentsV2: expect.any(Array),
      finance: expect.objectContaining({ metrics: expect.any(Array) }),
    });
    expect(details.overview.metrics).toBeInstanceOf(Array);

    await expect(apiClient.getClients()).resolves.toEqual(clientsMock);
    await expect(apiClient.getClient(clientId)).resolves.toEqual(clientsMock[0]);
    await expect(apiClient.getTasks()).resolves.toEqual(tasksMock);
    await expect(apiClient.getPayments()).resolves.toEqual(
      paymentsMock.map((payment) => ({
        ...payment,
        incomes: [],
        expenses: [],
      })),
    );
    await expect(apiClient.getPayments({ include: ["incomes", "expenses"] })).resolves.toEqual(
      paymentsMock,
    );
    const activity = await apiClient.getClientActivities(clientId, { page: 1, pageSize: 5 });
    expect(activity.items).toEqual(
      activitiesMock
        .filter((entry) => entry.clientId === clientId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    );
    expect(activity.total).toBeGreaterThan(0);

    const sortByUpdatedAtDesc = <T extends { updatedAt: string }>(items: T[]) =>
      [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const activePolicies = sortByUpdatedAtDesc(
      clientPoliciesMock.filter(
        (policy) => policy.clientId === clientId && !["archived", "cancelled", "expired"].includes(policy.status),
      ),
    );
    const archivedPolicies = sortByUpdatedAtDesc(
      clientPoliciesMock.filter(
        (policy) => policy.clientId === clientId && ["archived", "cancelled", "expired"].includes(policy.status),
      ),
    );

    await expect(apiClient.getClientPolicies(clientId, { status: "active" })).resolves.toEqual(activePolicies);
    await expect(apiClient.getClientPolicies(clientId, { status: "archived" })).resolves.toEqual(archivedPolicies);
    await expect(apiClient.getClientTasks(clientId)).resolves.toEqual(
      clientTaskChecklistMock.filter((task) => task.clientId === clientId),
    );
    await expect(apiClient.getClientReminders(clientId)).resolves.toEqual(
      clientRemindersMock
        .filter((reminder) => reminder.clientId === clientId)
        .sort((a, b) => new Date(a.occursAt).getTime() - new Date(b.occursAt).getTime()),
    );

    const updatedClient = await apiClient.updateClientContacts(clientId, {
      email: "new@example.com",
      phone: "+7 000 000-00-00",
      contacts: [
        { id: "email", type: "email", label: "E-mail", value: "new@example.com", primary: true },
        { id: "phone", type: "phone", label: "Телефон", value: "+7 000 000-00-00", primary: true },
      ],
    });
    expect(updatedClient.email).toBe("new@example.com");
    expect(updatedClient.phone).toBe("+7 000 000-00-00");

    await expect(apiClient.getDealStageMetrics()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "qualification" }),
      ]),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("возвращает stage metrics с учётом фильтров", async () => {
    const { apiClient } = await importClient();
    const metrics = await apiClient.getDealStageMetrics({ stage: "closedWon" });

    expect(metrics).toHaveLength(5);
    const closedWonMetrics = metrics.find((item) => item.stage === "closedWon");
    expect(closedWonMetrics).toBeDefined();
    expect(closedWonMetrics?.count ?? 0).toBeGreaterThan(0);
    expect(
      metrics
        .filter((item) => item.stage !== "closedWon")
        .every((item) => item.count === 0 && item.totalValue === 0),
    ).toBe(true);
  });

  it("использует fallback при ошибке формирования URL", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:9999";
    const { createApiClient } = await importClient();
    const { dealsMock } = await importMocks();
    const client = createApiClient({ baseUrl: "http://[" });

    await expect(client.getDeals()).resolves.toEqual(sortDealsByNextReview(dealsMock));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("использует fallback при сетевой ошибке", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { apiClient } = await importClient();
    const { dealsMock } = await importMocks();

    await expect(apiClient.getDeals()).resolves.toEqual(sortDealsByNextReview(dealsMock));
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

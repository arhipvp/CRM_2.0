/**
 * Гибридный сервис загрузки данных
 * Попытается загрузить real API, при ошибке fallback на mock данные
 */

import * as crmApi from './crmApi';
import { generateMockData } from './geminiService';
import type { Client, Deal, Policy, Payment, Task, FinancialTransaction } from '../types';

export interface DataLoadResult {
  clients: Client[];
  deals: Deal[];
  policies: Policy[];
  payments: Payment[];
  tasks: Task[];
  financialTransactions: FinancialTransaction[];
  isMocked: boolean; // флаг что это mock данные
}

/**
 * Загрузить данные с fallback на mock если API недоступен
 */
export async function loadDataWithFallback(): Promise<DataLoadResult> {
  try {
    // Попытка загрузить real API данные
    const [clientsData, dealsData, policiesData, tasksData] = await Promise.all([
      crmApi.fetchClients({ limit: 100 }),
      crmApi.fetchDeals({ limit: 100 }),
      crmApi.fetchPolicies({ limit: 100 }),
      crmApi.fetchTasks({ limit: 100 }),
    ]);

    // Нормализация данных сделок (добавить пустые массивы если нет данных)
    const normalizedDeals: Deal[] = dealsData.map((deal) => ({
      ...deal,
      tasks: (deal as any).tasks ?? [],
      notes: (deal as any).notes ?? [],
      quotes: (deal as any).quotes ?? [],
      files: (deal as any).files ?? [],
      chat: (deal as any).chat ?? [],
      activityLog: (deal as any).activityLog ?? [],
    }));

    // Загрузить платежи для каждого полиса
    const paymentsResponses = await Promise.all(
      policiesData
        .filter((policy) => Boolean(policy.dealId))
        .map(async (policy) => {
          try {
            return await crmApi.fetchPayments(policy.dealId as string, policy.id);
          } catch (paymentError) {
            console.warn(`Failed to fetch payments for policy ${policy.id}:`, paymentError);
            return [];
          }
        }),
    );

    const payments = paymentsResponses.flat();

    // Если получили какие-то данные - используем их
    if (clientsData.length > 0 || dealsData.length > 0) {
      console.log('[DataLoader] Using real API data');
      return {
        clients: clientsData,
        deals: normalizedDeals,
        policies: policiesData,
        payments,
        tasks: tasksData,
        financialTransactions: [],
        isMocked: false,
      };
    }

    // Если API вернул пустые данные - используем mock
    console.warn('[DataLoader] API returned empty data, falling back to mock');
    return loadMockData();
  } catch (error: any) {
    console.warn('[DataLoader] API error, falling back to mock:', error?.message);
    return loadMockData();
  }
}

/**
 * Загрузить mock данные (из geminiService)
 */
export function loadMockData(): DataLoadResult {
  console.log('[DataLoader] Using mock data (backend not available or error)');
  const mockData = generateMockData();
  return {
    clients: mockData.clients,
    deals: mockData.deals,
    policies: mockData.policies,
    payments: mockData.payments,
    tasks: [], // geminiService не генерирует tasks, используем пустой массив
    financialTransactions: mockData.financialTransactions,
    isMocked: true,
  };
}

/**
 * Создать сделку (real API или mock)
 */
export async function createDealWithFallback(
  deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
): Promise<Deal> {
  try {
    return await crmApi.createDeal(deal);
  } catch (error) {
    console.warn('[DataLoader] Failed to create deal via API, using mock');
    // Mock: создаём локально
    return {
      ...deal,
      id: `deal-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
  }
}

/**
 * Создать клиента (real API или mock)
 */
export async function createClientWithFallback(
  client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
): Promise<Client> {
  try {
    return await crmApi.createClient(client);
  } catch (error) {
    console.warn('[DataLoader] Failed to create client via API, using mock');
    // Mock: создаём локально
    return {
      ...client,
      id: `client-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
  }
}

/**
 * Обновить клиента (real API или mock)
 */
export async function updateClientWithFallback(
  clientId: string,
  updates: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>>,
): Promise<Client> {
  try {
    return await crmApi.updateClient(clientId, updates);
  } catch (error) {
    console.warn('[DataLoader] Failed to update client via API, using mock');
    // Mock: просто возвращаем updated клиента как есть
    // В реальном приложении это будет обновлено в state
    return {} as Client;
  }
}

/**
 * Создать полис (real API или mock)
 */
export async function createPolicyWithFallback(
  policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
): Promise<Policy> {
  try {
    return await crmApi.createPolicy(policy);
  } catch (error) {
    console.warn('[DataLoader] Failed to create policy via API, using mock');
    return {
      ...policy,
      id: `policy-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
  }
}

/**
 * Создать платёж (real API или mock)
 */
export async function createPaymentWithFallback(
  dealId: string,
  policyId: string,
  payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'policyId' | 'clientId' | 'status'>,
): Promise<Payment> {
  try {
    return await crmApi.createPayment(dealId, policyId, payment);
  } catch (error) {
    console.warn('[DataLoader] Failed to create payment via API, using mock');
    return {
      ...payment,
      id: `payment-${Date.now()}`,
      policyId,
      clientId: '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
  }
}

/**
 * Проверить доступность API
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    // Пытаемся получить пустой список - быстрый способ проверить доступность
    await crmApi.fetchClients({ limit: 1 });
    return true;
  } catch (error) {
    return false;
  }
}

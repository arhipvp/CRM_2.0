/**
 * Сервис загрузки данных из API
 * Все вызовы идут напрямую в crmApi, ошибки пробрасываются наружу
 */

import * as crmApi from './crmApi';
import type { Client, Deal, Policy, Payment, Task, FinancialTransaction } from '../types';

export interface DataLoadResult {
  clients: Client[];
  deals: Deal[];
  policies: Policy[];
  payments: Payment[];
  tasks: Task[];
  financialTransactions: FinancialTransaction[];
}

/**
 * Загрузить данные из API
 * Выбрасывает ошибку если API недоступен
 */
export async function loadData(): Promise<DataLoadResult> {
  // Загружаем основные данные параллельно
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

  // Загрузить платежи для каждого полиса (с таймаутом)
  const paymentTimeout = 10000; // 10 сек на каждый запрос платежей
  const paymentsResponses = await Promise.allSettled(
    policiesData
      .filter((policy) => Boolean(policy.dealId))
      .map(async (policy) => {
        try {
          // Добавляем таймаут для каждого запроса
          return await Promise.race([
            crmApi.fetchPayments(policy.dealId as string, policy.id),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Payment fetch timeout')), paymentTimeout)
            ),
          ]);
        } catch (paymentError) {
          console.warn(`Failed to fetch payments for policy ${policy.id}:`, paymentError);
          return [];
        }
      }),
  );

  const payments = paymentsResponses
    .filter((result) => result.status === 'fulfilled')
    .map((result) => (result as PromiseFulfilledResult<any>).value)
    .flat();

  return {
    clients: clientsData,
    deals: normalizedDeals,
    policies: policiesData,
    payments,
    tasks: tasksData,
    financialTransactions: [],
  };
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

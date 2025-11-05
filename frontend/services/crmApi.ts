/**
 * API методы для работы с CRM сущностями
 * Все методы используют apiClient и работают через Gateway
 */

import { apiClient } from './apiClient';
import type {
  Client,
  ClientCreateInput,
  ClientUpdateInput,
  Deal,
  Policy,
  PolicyRead,
  PolicyCreate,
  PolicyUpdate,
  Payment,
  PaymentRead,
  PaymentCreate,
  PaymentUpdate,
  PaymentIncomeRead,
  PaymentIncomeCreate,
  PaymentExpenseRead,
  PaymentExpenseCreate,
  Task,
  Quote,
} from '../types';

/**
 * ==================== CLIENTS ====================
 */

/**
 * Получить список всех клиентов
 */
export async function fetchClients(query?: { limit?: number; offset?: number; search?: string }): Promise<Client[]> {
  try {
    const params = new URLSearchParams();
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    if (query?.search) params.append('search', query.search);

    const response = await apiClient.get<Client[]>(`/crm/clients?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch clients:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Получить одного клиента по ID
 */
export async function getClient(clientId: string): Promise<Client> {
  try {
    const response = await apiClient.get<Client>(`/crm/clients/${clientId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch client ${clientId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создать нового клиента
 */
export async function createClient(client: ClientCreateInput): Promise<Client> {
  try {
    const response = await apiClient.post<Client>(`/crm/clients`, client);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create client:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Обновить клиента
 */
export async function updateClient(clientId: string, updates: ClientUpdateInput): Promise<Client> {
  try {
    const response = await apiClient.patch<Client>(`/crm/clients/${clientId}`, updates);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update client ${clientId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * ==================== DEALS ====================
 */

/**
 * Получить список всех сделок
 */
export async function fetchDeals(query?: { limit?: number; offset?: number; status?: string }): Promise<Deal[]> {
  try {
    const params = new URLSearchParams();
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    if (query?.status) params.append('status', query.status);

    const response = await apiClient.get<Deal[]>(`/crm/deals?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch deals:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Получить одну сделку по ID
 */
export async function getDeal(dealId: string): Promise<Deal> {
  try {
    const response = await apiClient.get<Deal>(`/crm/deals/${dealId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch deal ${dealId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создать новую сделку
 */
export async function createDeal(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Deal> {
  try {
    const response = await apiClient.post<Deal>(`/crm/deals`, deal);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create deal:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Обновить сделку
 */
export async function updateDeal(dealId: string, updates: Partial<Deal>): Promise<Deal> {
  try {
    const response = await apiClient.patch<Deal>(`/crm/deals/${dealId}`, updates);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update deal ${dealId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Получить журнал сделки
 */
export async function getDealJournal(dealId: string): Promise<any[]> {
  try {
    const response = await apiClient.get<any[]>(`/crm/deals/${dealId}/journal`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch deal journal ${dealId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Добавить запись в журнал сделки
 */
export async function addDealJournalEntry(dealId: string, entry: { content: string }): Promise<any> {
  try {
    const response = await apiClient.post(`/crm/deals/${dealId}/journal`, entry);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to add journal entry for deal ${dealId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * ==================== POLICIES ====================
 */

/**
 * Получить список полисов
 */
export async function fetchPolicies(query?: { limit?: number; offset?: number }): Promise<PolicyRead[]> {
  try {
    const params = new URLSearchParams();
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());

    const response = await apiClient.get<PolicyRead[]>(`/crm/policies?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch policies:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создать новый полис
 * Требует: policyNumber (уникальный), clientId
 * Опционально: dealId, ownerId, status, premium, effectiveFrom, effectiveTo
 */
export async function createPolicy(policy: PolicyCreate): Promise<PolicyRead> {
  try {
    const response = await apiClient.post<PolicyRead>(`/crm/policies`, policy);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create policy:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Обновить полис
 * Все поля опциональны
 */
export async function updatePolicy(policyId: string, updates: PolicyUpdate): Promise<PolicyRead> {
  try {
    const response = await apiClient.patch<PolicyRead>(`/crm/policies/${policyId}`, updates);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update policy ${policyId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * ==================== PAYMENTS ====================
 */

/**
 * Получить список платежей для полиса
 * Backend возвращает { items: PaymentRead[], total: number }
 * Преобразуем в массив PaymentRead[] для совместимости
 */
export async function fetchPayments(dealId: string, policyId: string): Promise<PaymentRead[]> {
  try {
    const response = await apiClient.get<{ items: PaymentRead[]; total: number }>(
      `/crm/deals/${dealId}/policies/${policyId}/payments`
    );
    // Парсим response.data.items, если response - объект с items, или берём данные как есть
    const items = response.data.items || response.data;
    return Array.isArray(items) ? items : [];
  } catch (error: any) {
    console.error('Failed to fetch payments:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создать новый платёж
 * Используем PaymentCreate для создания (plannedDate, plannedAmount, currency, comment)
 */
export async function createPayment(
  dealId: string,
  policyId: string,
  payment: Omit<PaymentCreate, 'dealId' | 'policyId'>
): Promise<PaymentRead> {
  try {
    const payload: PaymentCreate = {
      dealId,
      policyId,
      ...payment,
    };
    const response = await apiClient.post<PaymentRead>(
      `/crm/deals/${dealId}/policies/${policyId}/payments`,
      payload
    );
    return response.data;
  } catch (error: any) {
    console.error('Failed to create payment:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Обновить платёж
 * Используем PaymentUpdate для обновления (plannedDate, plannedAmount, currency, status, comment, actualDate)
 */
export async function updatePayment(
  dealId: string,
  policyId: string,
  paymentId: string,
  updates: PaymentUpdate
): Promise<PaymentRead> {
  try {
    const response = await apiClient.patch<PaymentRead>(
      `/crm/deals/${dealId}/policies/${policyId}/payments/${paymentId}`,
      updates
    );
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update payment ${paymentId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Удалить платёж
 */
export async function deletePayment(dealId: string, policyId: string, paymentId: string): Promise<void> {
  try {
    await apiClient.delete(`/crm/deals/${dealId}/policies/${policyId}/payments/${paymentId}`);
  } catch (error: any) {
    console.error(`Failed to delete payment ${paymentId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Получить доходы по платежу
 */
export async function fetchPaymentIncomes(dealId: string, policyId: string, paymentId: string): Promise<PaymentIncomeRead[]> {
  try {
    const response = await apiClient.get<PaymentIncomeRead[]>(
      `/crm/deals/${dealId}/policies/${policyId}/payments/${paymentId}/incomes`
    );
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch payment incomes:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создать доход по платежу
 */
export async function createPaymentIncome(
  dealId: string,
  policyId: string,
  paymentId: string,
  income: PaymentIncomeCreate
): Promise<PaymentIncomeRead> {
  try {
    const response = await apiClient.post<PaymentIncomeRead>(
      `/crm/deals/${dealId}/policies/${policyId}/payments/${paymentId}/incomes`,
      income
    );
    return response.data;
  } catch (error: any) {
    console.error('Failed to create payment income:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Получить расходы по платежу
 */
export async function fetchPaymentExpenses(dealId: string, policyId: string, paymentId: string): Promise<PaymentExpenseRead[]> {
  try {
    const response = await apiClient.get<PaymentExpenseRead[]>(
      `/crm/deals/${dealId}/policies/${policyId}/payments/${paymentId}/expenses`
    );
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch payment expenses:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создать расход по платежу
 */
export async function createPaymentExpense(
  dealId: string,
  policyId: string,
  paymentId: string,
  expense: PaymentExpenseCreate
): Promise<PaymentExpenseRead> {
  try {
    const response = await apiClient.post<PaymentExpenseRead>(
      `/crm/deals/${dealId}/policies/${policyId}/payments/${paymentId}/expenses`,
      expense
    );
    return response.data;
  } catch (error: any) {
    console.error('Failed to create payment expense:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * ==================== TASKS ====================
 */

/**
 * Получить список задач
 */
export async function fetchTasks(query?: { limit?: number; offset?: number }): Promise<Task[]> {
  try {
    const params = new URLSearchParams();
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());

    const response = await apiClient.get<Task[]>(`/crm/tasks?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch tasks:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Создать новую задачу
 */
export async function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Task> {
  try {
    const response = await apiClient.post<Task>(`/crm/tasks`, task);
    return response.data;
  } catch (error: any) {
    console.error('Failed to create task:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Обновить задачу
 */
export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  try {
    const response = await apiClient.patch<Task>(`/crm/tasks/${taskId}`, updates);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to update task ${taskId}:`, error.response?.data || error.message);
    throw error;
  }
}

export type {
  Client,
  Deal,
  Policy,
  PolicyRead,
  PolicyCreate,
  PolicyUpdate,
  Payment,
  PaymentRead,
  PaymentCreate,
  PaymentUpdate,
  PaymentIncomeRead,
  PaymentIncomeCreate,
  PaymentExpenseRead,
  PaymentExpenseCreate,
  Task,
  Quote,
};

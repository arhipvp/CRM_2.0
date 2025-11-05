/**
 * Типы и интерфейсы приложения CRM
 * Синхронизированы с backend API (Gateway преобразует snake_case → camelCase)
 */

/**
 * Стандартный ответ API
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  timestamp?: string;
}

/**
 * Paginated ответ от API
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * SSE событие от сервера
 */
export interface SSEEvent {
  type: string;
  event: string;
  data: any;
  timestamp?: string;
}

// Deal статусы (русский для UI, но соответствуют backend)
export type DealStatus = 'Новая' | 'Расчет' | 'Переговоры' | 'Оформление' | 'Ожидает продления' | 'Закрыта' | 'draft' | 'in_progress' | 'proposal' | 'negotiation' | 'contract' | 'won' | 'lost' | 'closed';

// Стадии сделок
export type DealStage = 'lead' | 'qualification' | 'negotiation' | 'proposal' | 'closing' | 'closed';

// Статусы полисов (backend: draft, active, inactive, suspended, expired, или любой другой строковый статус)
export type PolicyStatus = 'draft' | 'active' | 'inactive' | 'suspended' | 'expired' | string;

// Статусы платежей (соответствуют backend: scheduled, paid, cancelled, overdue)
export type PaymentStatus = 'scheduled' | 'paid' | 'cancelled' | 'overdue';

// Статусы клиентов
export type ClientStatus = 'active' | 'inactive' | 'prospect';

// Типы финансовых транзакций
export type FinancialTransactionType = 'Доход' | 'Расход' | 'income' | 'expense';

/**
 * Клиент - основная сущность для страховых контрактов
 * Соответствует backend модели: /api/v1/crm/clients
 */
export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  notes?: string;
  status: ClientStatus;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/**
 * Данные для создания клиента
 */
export interface ClientCreateInput {
  name: string;
  email?: string;
  phone?: string;
  status: ClientStatus;
  ownerId?: string | null;
}

/**
 * Поля для обновления клиента
 */
export type ClientUpdateInput = Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>>;

/**
 * Сделка - контракт страхования с клиентом
 * Соответствует backend модели: /api/v1/crm/deals
 */
export interface Deal {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  ownerId?: string | null;
  owner?: string | null;
  assistant?: string | null;
  status: DealStatus;
  stage?: DealStage;
  nextReviewAt: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  summary?: string;
  tasks?: Task[];
  notes?: Note[];
  quotes?: Quote[];
  files?: FileAttachment[];
  chat?: ChatMessage[];
  activityLog?: ActivityLog[];
}

/**
 * Полис страхования (ответ от API)
 * Соответствует backend PolicyRead: /api/v1/policies
 */
export interface PolicyRead {
  id: string;
  policyNumber: string; // Уникальный номер полиса, предоставляемый клиентом
  clientId: string; // FK к клиенту
  dealId?: string; // FK к сделке (опционально)
  calculationId?: string; // FK к расчёту (опционально)
  ownerId?: string; // ID владельца/пользователя, отвечающего за полис
  status: PolicyStatus; // draft, active, inactive, suspended, expired, etc.
  premium?: string; // Страховой взнос (опционально)
  effectiveFrom?: string; // Дата начала действия (ISO date)
  effectiveTo?: string; // Дата окончания действия (ISO date)
  createdAt: string;
  updatedAt: string;
}

/**
 * Данные для создания полиса
 */
export interface PolicyCreate {
  policyNumber: string; // Обязательный уникальный номер
  clientId: string;
  dealId?: string;
  ownerId?: string;
  status?: PolicyStatus; // По умолчанию 'draft'
  premium?: string | number; // Страховой взнос
  effectiveFrom?: string; // Дата начала действия
  effectiveTo?: string; // Дата окончания действия
}

/**
 * Данные для обновления полиса
 */
export interface PolicyUpdate {
  policyNumber?: string;
  status?: PolicyStatus;
  premium?: string | number;
  effectiveFrom?: string;
  effectiveTo?: string;
  ownerId?: string;
  dealId?: string;
}

/**
 * Совместимость: для кода, использующего Policy (alias к PolicyRead)
 */
export type Policy = PolicyRead;

/**
 * Платёж по полису (ответ от API)
 * Соответствует backend PaymentRead: /api/v1/crm/deals/{dealId}/policies/{policyId}/payments
 * Поля: plannedAmount (string), plannedDate, currency, status, totals как строки
 */
export interface PaymentRead {
  id: string;
  dealId: string;
  policyId: string;
  sequence: number; // порядковый номер платежа
  plannedDate: string; // ISO date
  plannedAmount: string; // числовое значение как строка
  currency: string; // "RUB" и т.п.
  status: PaymentStatus; // scheduled, paid, cancelled, overdue
  comment?: string;
  actualDate?: string; // фактическая дата оплаты (null если не оплачен)
  recordedById?: string; // ID пользователя, записавшего платёж
  incomesTotal: string; // сумма доходов по платежу (строка)
  expensesTotal: string; // сумма расходов по платежу (строка)
  netTotal: string; // чистая прибыль (инкомсы - расходы)
  incomes?: PaymentIncomeRead[];
  expenses?: PaymentExpenseRead[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Данные для создания платежа
 */
export interface PaymentCreate {
  dealId: string;
  policyId: string;
  plannedDate: string; // ISO date
  plannedAmount: number; // числовое значение
  currency?: string; // по умолчанию "RUB"
  comment?: string;
}

/**
 * Данные для обновления платежа
 */
export interface PaymentUpdate {
  plannedDate?: string;
  plannedAmount?: number;
  currency?: string;
  status?: PaymentStatus;
  comment?: string;
  actualDate?: string;
}

/**
 * Совместимость: для кода, использующего Payment (может быть alias к PaymentRead)
 */
export type Payment = PaymentRead;

/**
 * Доход по платежу (ответ от API)
 */
export interface PaymentIncomeRead {
  id: string;
  paymentId: string;
  amount: string; // строка
  currency: string;
  category: string; // категория дохода
  postedAt: string; // ISO date when the income was posted
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Данные для создания дохода по платежу
 */
export interface PaymentIncomeCreate {
  amount: number;
  currency?: string;
  category: string;
  postedAt: string;
  note?: string;
}

/**
 * Расход по платежу (ответ от API)
 */
export interface PaymentExpenseRead {
  id: string;
  paymentId: string;
  amount: string; // строка
  currency: string;
  category: string; // категория расхода
  postedAt: string; // ISO date when the expense was posted
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Данные для создания расхода по платежу
 */
export interface PaymentExpenseCreate {
  amount: number;
  currency?: string;
  category: string;
  postedAt: string;
  note?: string;
}

/**
 * Задача
 * Соответствует backend модели: /api/v1/crm/tasks
 */
export interface Task {
  id: string;
  title?: string;
  description?: string;
  dealId?: string;
  clientId?: string;
  status?: 'open' | 'in_progress' | 'completed' | 'cancelled';
  statusCode?: string;
  priority?: 'low' | 'medium' | 'high';
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  dueAt?: string;
  scheduledFor?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  // Опциональные поля
  completed?: boolean;
  assignee?: string;
  subtasks?: Subtask[];
  attachments?: FileAttachment[];
}

/**
 * Подзадача
 */
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  completed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Записка / Заметка
 */
export interface Note {
  id: string;
  content: string;
  dealId?: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

/**
 * Расчет / Котировка от страховщика
 */
export interface Quote {
  id: string;
  dealId: string;
  insurer: string;
  insuranceType: PolicyType;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/**
 * Прикрепленный файл
 */
export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  url: string;
  documentId?: string;
  createdAt: string;
}

/**
 * Сообщение в чате сделки
 */
export interface ChatMessage {
  id: string;
  dealId: string;
  sender: string;
  senderName?: string;
  text: string;
  timestamp: string;
  attachments?: FileAttachment[];
}

/**
 * Запись в журнале активности сделки
 */
export interface ActivityLog {
  id: string;
  dealId: string;
  timestamp: string;
  userId: string;
  user?: string;
  action: string;
  description?: string;
  changes?: Record<string, any>;
}

/**
 * Финансовая транзакция
 */
export interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string; // planned date
  paymentDate?: string; // actual payment date
  dealId?: string;
  policyId?: string;
  createdAt: string;
  updatedAt: string;
}

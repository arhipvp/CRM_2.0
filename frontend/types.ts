/**
 * Типы и интерфейсы приложения CRM
 * Синхронизированы с backend API (Gateway преобразует snake_case → camelCase)
 */

// Deal статусы (русский для UI, но соответствуют backend)
export type DealStatus = 'Новая' | 'Расчет' | 'Переговоры' | 'Оформление' | 'Ожидает продления' | 'Закрыта' | 'draft' | 'in_progress' | 'proposal' | 'negotiation' | 'contract' | 'won' | 'lost' | 'closed';

// Стадии сделок
export type DealStage = 'lead' | 'qualification' | 'negotiation' | 'proposal' | 'closing' | 'closed';

// Типы полисов
export type PolicyType = 'Авто' | 'Имущество' | 'Жизнь' | 'Здоровье' | 'Auto' | 'Property' | 'Life' | 'Health';

// Статусы платежей
export type PaymentStatus = 'Оплачен' | 'Просрочен' | 'Ожидает' | 'pending' | 'paid' | 'overdue' | 'cancelled';

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
  status: DealStatus;
  stage?: DealStage;
  nextReviewAt: string;
  nextReviewDate?: string;
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
 * Полис страхования
 * Соответствует backend модели: /api/v1/crm/policies
 */
export interface Policy {
  id: string;
  policyNumber: string;
  type: PolicyType;
  clientId: string;
  dealId?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  counterparty?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  // Опциональные поля
  carBrand?: string;
  carModel?: string;
  vin?: string;\n  salesChannel?: string;
  notes?: string;
}

/**
 * Платёж по полису
 * Соответствует backend модели: /api/v1/crm/deals/{dealId}/policies/{policyId}/payments
 */
export interface Payment {
  id: string;
  policyId: string;
  dealId?: string;
  clientId?: string;
  amount: number;
  status: PaymentStatus;
  dueDate?: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  // Доходы и расходы
  incomes?: PaymentIncome[];
  expenses?: PaymentExpense[];
}

/**
 * Доход по платежу
 */
export interface PaymentIncome {
  id: string;
  paymentId: string;
  amount: number;
  date: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/**
 * Расход по платежу
 */
export interface PaymentExpense {
  id: string;
  paymentId: string;
  amount: number;
  date: string;
  category?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
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

/**
 * Конвертеры типов между mock data форматом и backend форматом
 */

import type { DealStatus, PaymentStatus, PolicyType } from '../types';

/**
 * Конвертировать старый русский статус сделки в новый английский формат
 */
export function convertDealStatusToBackend(oldStatus: string): DealStatus {
  const mapping: Record<string, DealStatus> = {
    'Новая': 'draft',
    'Расчет': 'proposal',
    'Переговоры': 'negotiation',
    'Оформление': 'contract',
    'Ожидает продления': 'in_progress',
    'Закрыта': 'closed',
    // Обратное преобразование
    'draft': 'draft',
    'in_progress': 'in_progress',
    'proposal': 'proposal',
    'negotiation': 'negotiation',
    'contract': 'contract',
    'won': 'won',
    'lost': 'lost',
    'closed': 'closed',
  };
  return mapping[oldStatus] || 'draft';
}

/**
 * Конвертировать старый русский статус платежа в новый английский формат
 */
export function convertPaymentStatusToBackend(oldStatus: string): PaymentStatus {
  const mapping: Record<string, PaymentStatus> = {
    'Оплачен': 'paid',
    'Просрочен': 'overdue',
    'Ожидает': 'pending',
    'paid': 'paid',
    'pending': 'pending',
    'overdue': 'overdue',
    'cancelled': 'cancelled',
  };
  return mapping[oldStatus] || 'pending';
}

/**
 * Конвертировать старый русский тип полиса в новый английский формат
 */
export function convertPolicyTypeToBackend(oldType: string): PolicyType {
  const mapping: Record<string, PolicyType> = {
    'Авто': 'Auto',
    'Имущество': 'Property',
    'Жизнь': 'Life',
    'Здоровье': 'Health',
    'Auto': 'Auto',
    'Property': 'Property',
    'Life': 'Life',
    'Health': 'Health',
  };
  return mapping[oldType] || 'Auto';
}

/**
 * Конвертировать новый статус сделки в русский (для display)
 */
export function displayDealStatus(status: DealStatus): string {
  const mapping: Record<string, string> = {
    'draft': 'Новая',
    'in_progress': 'В работе',
    'proposal': 'Расчет',
    'negotiation': 'Переговоры',
    'contract': 'Оформление',
    'won': 'Выигранная',
    'lost': 'Потеряна',
    'closed': 'Закрыта',
    'Новая': 'Новая',
    'Расчет': 'Расчет',
    'Переговоры': 'Переговоры',
    'Оформление': 'Оформление',
    'Ожидает продления': 'Ожидает продления',
    'Закрыта': 'Закрыта',
  };
  return mapping[status] || status;
}

/**
 * Конвертировать новый статус платежа в русский (для display)
 */
export function displayPaymentStatus(status: PaymentStatus): string {
  const mapping: Record<string, string> = {
    'paid': 'Оплачен',
    'pending': 'Ожидает',
    'overdue': 'Просрочен',
    'cancelled': 'Отменён',
    'Оплачен': 'Оплачен',
    'Просрочен': 'Просрочен',
    'Ожидает': 'Ожидает',
  };
  return mapping[status] || status;
}

/**
 * Конвертировать новый тип полиса в русский (для display)
 */
export function displayPolicyType(type: PolicyType): string {
  const mapping: Record<string, string> = {
    'Auto': 'Авто',
    'Property': 'Имущество',
    'Life': 'Жизнь',
    'Health': 'Здоровье',
    'Авто': 'Авто',
    'Имущество': 'Имущество',
    'Жизнь': 'Жизнь',
    'Здоровье': 'Здоровье',
  };
  return mapping[type] || type;
}

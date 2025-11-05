import type { PaymentStatus } from '../types';

export type PaymentStatusCode = 'scheduled' | 'paid' | 'overdue' | 'cancelled';

/**
 * Статус платежа из backend: scheduled, paid, cancelled, overdue
 * Отображение на русский для UI
 */
const STATUS_MAP: Record<PaymentStatusCode, { label: string; className: string }> = {
  scheduled: { label: 'Запланирован', className: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Оплачен', className: 'bg-green-100 text-green-800' },
  overdue: { label: 'Просрочен', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Отменён', className: 'bg-slate-200 text-slate-600' },
};

/**
 * Маппирование русских наименований и старых статусов на новые коды
 */
const RUS_TO_CODE: Record<string, PaymentStatusCode> = {
  // Русские варианты
  'запланирован': 'scheduled',
  'ожидает': 'scheduled', // старое значение -> новое
  'оплачен': 'paid',
  'оплата': 'paid',
  'просрочен': 'overdue',
  'просрочено': 'overdue',
  'отменён': 'cancelled',
  'отменен': 'cancelled',
  // Backend статусы
  'pending': 'scheduled', // старое значение -> новое
  'scheduled': 'scheduled',
  'paid': 'paid',
  'overdue': 'overdue',
  'cancelled': 'cancelled',
};

/**
 * Нормализует статус из API/формы к стандартному коду.
 * Поддерживает как старые статусы (pending), так и новые (scheduled)
 */
export const normalizePaymentStatus = (
  status?: PaymentStatus | string | null,
): PaymentStatusCode => {
  if (!status) {
    return 'scheduled'; // default: scheduled
  }

  const normalized = status.toString().trim().toLowerCase();
  if (normalized in RUS_TO_CODE) {
    return RUS_TO_CODE[normalized];
  }

  if (normalized in STATUS_MAP) {
    return normalized as PaymentStatusCode;
  }

  return 'scheduled'; // default: scheduled
};

/**
 * Возвращает подпись для отображения статуса.
 */
export const paymentStatusLabel = (status?: PaymentStatus | string | null): string => {
  const code = normalizePaymentStatus(status);
  return STATUS_MAP[code].label;
};

/**
 * Возвращает CSS-класс для бейджа статуса.
 */
export const paymentStatusClassName = (
  status?: PaymentStatus | string | null,
): string => {
  const code = normalizePaymentStatus(status);
  return STATUS_MAP[code].className;
};

/**
 * Список опций статусов для select'ов.
 */
export const paymentStatusOptions = Object.entries(STATUS_MAP).map(([value, meta]) => ({
  value: value as PaymentStatusCode,
  label: meta.label,
}));

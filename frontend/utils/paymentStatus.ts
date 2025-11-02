import type { Payment } from '../types';

export type PaymentStatusCode = 'pending' | 'paid' | 'overdue' | 'cancelled';

const STATUS_MAP: Record<PaymentStatusCode, { label: string; className: string }> = {
  pending: { label: 'Ожидает', className: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Оплачен', className: 'bg-green-100 text-green-800' },
  overdue: { label: 'Просрочен', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Отменён', className: 'bg-slate-200 text-slate-600' },
};

const RUS_TO_CODE: Record<string, PaymentStatusCode> = {
  'ожидает': 'pending',
  'оплачен': 'paid',
  'оплата': 'paid',
  'просрочен': 'overdue',
  'просрочено': 'overdue',
  'отменён': 'cancelled',
  'отменен': 'cancelled',
  'cancelled': 'cancelled',
};

/**
 * Нормализует статус из API/формы к стандартному коду.
 */
export const normalizePaymentStatus = (
  status?: Payment['status'] | string | null,
): PaymentStatusCode => {
  if (!status) {
    return 'pending';
  }

  const normalized = status.toString().trim().toLowerCase();
  if (normalized in RUS_TO_CODE) {
    return RUS_TO_CODE[normalized];
  }

  if (normalized in STATUS_MAP) {
    return normalized as PaymentStatusCode;
  }

  return 'pending';
};

/**
 * Возвращает подпись для отображения статуса.
 */
export const paymentStatusLabel = (status?: Payment['status'] | string | null): string => {
  const code = normalizePaymentStatus(status);
  return STATUS_MAP[code].label;
};

/**
 * Возвращает CSS-класс для бейджа статуса.
 */
export const paymentStatusClassName = (
  status?: Payment['status'] | string | null,
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

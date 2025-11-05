import React, { useState } from 'react';
import type { PaymentCreate } from '../types';
import { paymentStatusOptions } from '../utils/paymentStatus';

interface AddPaymentFormProps {
  policyId: string;
  onAddPayment: (paymentData: Omit<PaymentCreate, 'dealId' | 'policyId'>) => Promise<void>;
  onClose: () => void;
}

export const AddPaymentForm: React.FC<AddPaymentFormProps> = ({ policyId, onAddPayment, onClose }) => {
  const [plannedAmount, setPlannedAmount] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plannedAmount || !plannedDate) {
      setError('Пожалуйста, заполните все обязательные поля: Сумма и Запланированная дата.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      await onAddPayment({
        plannedDate,
        plannedAmount: parseFloat(plannedAmount) || 0,
        currency,
        comment: comment || undefined,
      });
      onClose();
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось создать платеж. Попробуйте ещё раз.';
      setError(typeof message === 'string' ? message : 'Не удалось создать платеж.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const inputStyle = "mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50 text-sm";
  const labelStyle = "block text-sm font-medium text-slate-700";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Добавить платеж</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <div className="space-y-4">
          <div>
            <label htmlFor="plannedAmount" className={labelStyle}>Сумма платежа*</label>
            <input
              type="number"
              id="plannedAmount"
              placeholder="10000"
              value={plannedAmount}
              onChange={(e) => setPlannedAmount(e.target.value)}
              className={inputStyle}
              step="0.01"
            />
          </div>
          <div>
            <label htmlFor="plannedDate" className={labelStyle}>Запланированная дата*</label>
            <input
              type="date"
              id="plannedDate"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="currency" className={labelStyle}>Валюта</label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputStyle}
            >
              <option value="RUB">RUB (Рубль)</option>
              <option value="USD">USD (Доллар)</option>
              <option value="EUR">EUR (Евро)</option>
            </select>
          </div>
          <div>
            <label htmlFor="comment" className={labelStyle}>Комментарий</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={inputStyle}
              rows={3}
              placeholder="Дополнительная информация о платеже..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-60"
            disabled={isSubmitting}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Сохраняю…' : 'Добавить'}
          </button>
        </div>
      </form>
    </div>
  );
};

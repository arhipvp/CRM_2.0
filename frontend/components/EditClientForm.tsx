import React, { useState, useEffect } from 'react';
import { Client, ClientStatus, ClientUpdateInput } from '../types';

interface EditClientFormProps {
  client: Client;
  onUpdateClient: (clientId: string, updates: ClientUpdateInput) => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'active', label: 'Активный' },
  { value: 'inactive', label: 'Неактивный' },
  { value: 'prospect', label: 'Потенциальный' },
];

const ConfirmationModal: React.FC<{
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}> = ({ onConfirm, onCancel, isLoading }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
      <h3 className="text-lg font-semibold text-slate-800">Подтвердите изменения</h3>
      <p className="text-sm text-slate-500 mt-2">
        Вы уверены, что хотите сохранить изменения по клиенту?
      </p>
      <div className="flex justify-center mt-6 space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 w-24"
          disabled={isLoading}
        >
          Отмена
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 w-28 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </div>
  </div>
);

export const EditClientForm: React.FC<EditClientFormProps> = ({ client, onUpdateClient, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<ClientStatus>('active');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(client.name || '');
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setStatus(client.status);
    setOwnerId(client.ownerId || '');
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Имя клиента обязательно.');
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmUpdate = async () => {
    setSubmitting(true);
    setError('');

    const updates: ClientUpdateInput = {
      name: name.trim(),
      status,
      email: email.trim() ? email.trim() : undefined,
      phone: phone.trim() ? phone.trim() : undefined,
      ownerId: ownerId.trim() ? ownerId.trim() : null,
    };

    try {
      await onUpdateClient(client.id, updates);
      onClose();
    } catch (err: any) {
      const apiMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось сохранить изменения. Попробуйте ещё раз.';
      setError(typeof apiMessage === 'string' ? apiMessage : 'Не удалось сохранить изменения.');
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const inputStyle =
    'mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Редактировать клиента</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-md">{error}</p>}

          <div>
            <label htmlFor="client-name" className="block text-sm font-medium text-slate-700">
              Имя*
            </label>
            <input
              type="text"
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="client-email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              id="client-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="client-phone" className="block text-sm font-medium text-slate-700">
              Телефон
            </label>
            <input
              type="tel"
              id="client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="client-status" className="block text-sm font-medium text-slate-700">
              Статус*
            </label>
            <select
              id="client-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientStatus)}
              className={inputStyle}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="client-owner" className="block text-sm font-medium text-slate-700">
              ID ответственного (опционально)
            </label>
            <input
              type="text"
              id="client-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div className="flex justify-end pt-4 space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Сохранить изменения
            </button>
          </div>
        </form>
      </div>
      {isConfirmOpen && (
        <ConfirmationModal
          onConfirm={handleConfirmUpdate}
          onCancel={() => setConfirmOpen(false)}
          isLoading={isSubmitting}
        />
      )}
    </>
  );
};

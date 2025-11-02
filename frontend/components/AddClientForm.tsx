import React, { useState } from 'react';
import { ClientCreateInput, ClientStatus } from '../types';

interface AddClientFormProps {
  onAddClient: (clientData: ClientCreateInput) => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'active', label: 'Активный' },
  { value: 'inactive', label: 'Неактивный' },
  { value: 'prospect', label: 'Потенциальный' },
];

export const AddClientForm: React.FC<AddClientFormProps> = ({ onAddClient, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<ClientStatus>('active');
  const [ownerId, setOwnerId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Имя клиента обязательно.');
      return;
    }

    setSubmitting(true);

    const payload: ClientCreateInput = {
      name: name.trim(),
      status,
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(ownerId.trim() ? { ownerId: ownerId.trim() } : {}),
    };

    try {
      await onAddClient(payload);
      onClose();
    } catch (err: any) {
      const apiMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось создать клиента. Попробуйте ещё раз.';
      setError(typeof apiMessage === 'string' ? apiMessage : 'Не удалось создать клиента.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle =
    'mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50';

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Добавить клиента</h2>
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
          placeholder="ООО «Ромашка» или Иван Иванов"
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
          placeholder="contact@romashka.ru"
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
          placeholder="+7 (999) 123-45-67"
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
          placeholder="uuid пользователя"
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
          {isSubmitting ? 'Сохраняю…' : 'Добавить клиента'}
        </button>
      </div>
    </form>
  );
};

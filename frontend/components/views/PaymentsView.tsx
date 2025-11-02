import React, { useState, useMemo } from 'react';
import { Payment, Policy, Client } from '../../types';
import {
  normalizePaymentStatus,
  paymentStatusClassName,
  paymentStatusLabel,
  paymentStatusOptions,
  PaymentStatusCode,
} from '../../utils/paymentStatus';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const getClientName = (clientId: string, clients: Client[]) =>
  clients.find((client) => client.id === clientId)?.name || 'N/A';

const getPolicyNumber = (policyId: string, policies: Policy[]) =>
  policies.find((policy) => policy.id === policyId)?.policyNumber || 'N/A';

const StatusBadge: React.FC<{ status: Payment['status'] }> = ({ status }) => (
  <span className={`px-2 py-1 text-xs font-medium rounded-full ${paymentStatusClassName(status)}`}>
    {paymentStatusLabel(status)}
  </span>
);

interface PaymentsViewProps {
  payments: Payment[];
  policies: Policy[];
  clients: Client[];
}

type EnrichedPayment = Payment & {
  clientName: string;
  policyNumber: string;
};

type SortKeys = keyof EnrichedPayment;
type StatusFilter = 'all' | PaymentStatusCode;

export const PaymentsView: React.FC<PaymentsViewProps> = ({ payments, policies, clients }) => {
  const [filters, setFilters] = useState({
    clientName: '',
    policyNumber: '',
    dueDate: '',
    status: 'all' as StatusFilter,
  });

  const [sortConfig, setSortConfig] = useState<{ key: SortKeys; direction: 'ascending' | 'descending' } | null>({
    key: 'dueDate',
    direction: 'ascending',
  });

  const enrichedPayments = useMemo<EnrichedPayment[]>(() => {
    return payments.map((payment) => ({
      ...payment,
      clientName: getClientName(payment.clientId || '', clients),
      policyNumber: getPolicyNumber(payment.policyId, policies),
    }));
  }, [payments, policies, clients]);

  const filteredAndSortedPayments = useMemo(() => {
    let filteredData = [...enrichedPayments];

    filteredData = filteredData.filter((payment) => {
      const normalizedStatus = normalizePaymentStatus(payment.status);
      return (
        payment.clientName.toLowerCase().includes(filters.clientName.toLowerCase()) &&
        payment.policyNumber.toLowerCase().includes(filters.policyNumber.toLowerCase()) &&
        (filters.dueDate ? payment.dueDate?.includes(filters.dueDate) : true) &&
        (filters.status === 'all' || normalizedStatus === normalizePaymentStatus(filters.status))
      );
    });

    if (sortConfig) {
      filteredData.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        let comparison = 0;
        if (sortConfig.key === 'amount') {
          comparison = (aValue as number) - (bValue as number);
        } else if (sortConfig.key === 'dueDate') {
          comparison =
            new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
        } else {
          comparison = (String(aValue)).localeCompare(String(bValue), 'ru');
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }

    return filteredData;
  }, [enrichedPayments, filters, sortConfig]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const requestSort = (key: SortKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';

    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }

    setSortConfig({ key, direction });
  };

  const getSortDirection = (key: SortKeys) => {
    if (!sortConfig || sortConfig.key !== key) return undefined;
    return sortConfig.direction;
  };

  const headers: { label: string; key: SortKeys }[] = [
    { label: 'Клиент', key: 'clientName' },
    { label: 'Номер полиса', key: 'policyNumber' },
    { label: 'Сумма', key: 'amount' },
    { label: 'Срок оплаты', key: 'dueDate' },
    { label: 'Статус', key: 'status' },
  ];

  return (
    <div className="p-8 overflow-y-auto h-full">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">
        Платежи ({filteredAndSortedPayments.length})
      </h1>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((header) => (
                <th
                  key={header.key}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                >
                  <button
                    onClick={() => requestSort(header.key)}
                    className="flex items-center w-full text-left focus:outline-none"
                  >
                    {header.label}
                    <SortIcon direction={getSortDirection(header.key)} />
                  </button>
                </th>
              ))}
            </tr>
            <tr className="bg-slate-100">
              <th className="p-2 font-normal">
                <input
                  type="text"
                  name="clientName"
                  onChange={handleFilterChange}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                  placeholder="Поиск..."
                />
              </th>
              <th className="p-2 font-normal">
                <input
                  type="text"
                  name="policyNumber"
                  onChange={handleFilterChange}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                  placeholder="Поиск..."
                />
              </th>
              <th className="p-2 font-normal" />
              <th className="p-2 font-normal">
                <input
                  type="date"
                  name="dueDate"
                  onChange={handleFilterChange}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                />
              </th>
              <th className="p-2 font-normal">
                <select
                  name="status"
                  onChange={handleFilterChange}
                  value={filters.status}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                >
                  <option value="all">Все</option>
                  {paymentStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredAndSortedPayments.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                  {payment.clientName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  {payment.policyNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {payment.dueDate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <StatusBadge status={payment.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAndSortedPayments.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            Платежи, подходящие под выбранные фильтры, не найдены.
          </p>
        )}
      </div>
    </div>
  );
};

const SortIcon: React.FC<{ direction?: 'ascending' | 'descending' }> = ({ direction }) => {
  if (!direction) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 inline-block ml-1 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    );
  }

  if (direction === 'ascending') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 inline-block ml-1 text-sky-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 inline-block ml-1 text-sky-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
};

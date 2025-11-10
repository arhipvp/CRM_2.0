import React, { useMemo, useState } from 'react';
import { Policy, Client, Payment } from '../../types';
import {
  normalizePaymentStatus,
  paymentStatusClassName,
  paymentStatusLabel,
  paymentStatusOptions,
} from '../../utils/paymentStatus';
import type { PaymentStatusCode } from '../../utils/paymentStatus';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const getClientName = (clientId: string, clients: Client[]) =>
  clients.find((client) => client.id === clientId)?.name || 'Неизвестный клиент';

const getPaymentStatusInfo = (
  policyId: string,
  payments: Payment[],
): { code: PaymentStatusCode | 'none'; text: string; className: string } => {
  const policyPayments = payments.filter((payment) => payment.policyId === policyId);

  if (policyPayments.length === 0) {
    return { code: 'none', text: 'Нет платежей', className: 'bg-slate-100 text-slate-600' };
  }

  const statuses = policyPayments.map((payment) => normalizePaymentStatus(payment.status));
  const statusSet = new Set(statuses);

  const buildStatusInfo = (code: PaymentStatusCode) => ({
    code,
    text: paymentStatusLabel(code),
    className: paymentStatusClassName(code),
  });

  if (statusSet.has('overdue')) {
    return buildStatusInfo('overdue');
  }

  if (statusSet.has('scheduled')) {
    return buildStatusInfo('scheduled');
  }

  if (statusSet.has('paid')) {
    return buildStatusInfo('paid');
  }

  if (statusSet.has('cancelled')) {
    return buildStatusInfo('cancelled');
  }

  return buildStatusInfo('scheduled');
};

const getDaysNoun = (days: number): string => {
  const cases = [2, 0, 1, 1, 1, 2];
  const titles = ['день', 'дня', 'дней'];
  const number = Math.abs(days);
  return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
};

const RENEWAL_REMINDER_DAYS = 30;

type PaymentStatusInfo = {
  code: PaymentStatusCode | 'none';
  text: string;
  className: string;
};

type EnrichedPolicy = Policy & {
  clientName: string;
  policyPremium: number;
  paymentStatusInfo: PaymentStatusInfo;
  isDueForRenewal: boolean;
  daysUntilRenewal: number | null;
};

type SortKeys = keyof EnrichedPolicy | 'policyPremium';

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

const PaymentStatusBadge: React.FC<{ statusInfo: PaymentStatusInfo }> = ({ statusInfo }) => (
  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.className}`}>
    {statusInfo.text}
  </span>
);

interface PoliciesViewProps {
  policies: Policy[];
  clients: Client[];
  payments: Payment[];
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ policies, clients, payments }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    type: string;
    startDate: string;
    endDate: string;
    paymentStatus: 'all' | PaymentStatusCode | 'none';
  }>({
    type: 'all',
    startDate: '',
    endDate: '',
    paymentStatus: 'all',
  });

  const [sortConfig, setSortConfig] = useState<{ key: SortKeys; direction: 'ascending' | 'descending' } | null>({
    key: 'endDate',
    direction: 'ascending',
  });

  const enrichedPolicies = useMemo<EnrichedPolicy[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return policies.map((policy) => {
      const endDate = policy.endDate ? new Date(policy.endDate) : null;
      const daysUntilRenewal = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24)) : null;
      const isDueForRenewal =
        endDate !== null && daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= RENEWAL_REMINDER_DAYS;

      const policyPayments = payments.filter((payment) => payment.policyId === policy.id);
      const policyPremium = policyPayments.reduce((sum, payment) => {
        const amount = Number(payment.plannedAmount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);

      return {
        ...policy,
        clientName: getClientName(policy.clientId, clients),
        policyPremium,
        paymentStatusInfo: getPaymentStatusInfo(policy.id, payments),
        isDueForRenewal,
        daysUntilRenewal: isDueForRenewal ? daysUntilRenewal : null,
      };
    });
  }, [policies, clients, payments]);

  const filteredAndSortedPolicies = useMemo(() => {
    let data = [...enrichedPolicies];
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      data = data.filter((policy) => {
        const haystack = `${policy.policyNumber} ${policy.clientName} ${policy.counterparty}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    data = data.filter((policy) => {
      const matchesType = filters.type === 'all' || policy.type === filters.type;
      const matchesStartDate = filters.startDate ? policy.startDate?.includes(filters.startDate) : true;
      const matchesEndDate = filters.endDate ? policy.endDate?.includes(filters.endDate) : true;

      const matchesPaymentStatus =
        filters.paymentStatus === 'all'
          ? true
          : filters.paymentStatus === 'none'
            ? policy.paymentStatusInfo.code === 'none'
            : policy.paymentStatusInfo.code === filters.paymentStatus;

      return matchesType && matchesStartDate && matchesEndDate && matchesPaymentStatus;
    });

    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        let comparison = 0;

        if (sortConfig.key === 'policyPremium') {
          comparison = (aValue as number) - (bValue as number);
        } else if (sortConfig.key === 'startDate' || sortConfig.key === 'endDate') {
          comparison =
            new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
        } else if (sortConfig.key === 'paymentStatusInfo') {
          comparison = a.paymentStatusInfo.text.localeCompare(b.paymentStatusInfo.text, 'ru');
        } else {
          comparison = String(aValue).localeCompare(String(bValue), 'ru');
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }

    return data;
  }, [enrichedPolicies, searchQuery, filters, sortConfig]);

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

  const uniquePolicyTypes = useMemo(() => {
    // Deduplicate and filter out empty/invalid policy types
    const types = new Set(policies.map((policy) => policy.type).filter(Boolean));
    return Array.from(types);
  }, [policies]);

  const paymentStatusFilterOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'Все' },
      ...paymentStatusOptions,
      { value: 'none' as const, label: 'Нет платежей' },
    ],
    [],
  );

  const getSortDirection = (key: SortKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return undefined;
    }
    return sortConfig.direction;
  };

  return (
    <div className="p-8 overflow-y-auto h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">
          Полисы ({filteredAndSortedPolicies.length})
        </h1>
        <div className="w-full max-w-sm">
          <label htmlFor="search-policies" className="sr-only">
            Поиск
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              id="search-policies"
              type="text"
              placeholder="Поиск по номеру, клиенту, контрагенту..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-white border-slate-300 rounded-md text-sm p-2 pl-10 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Номер полиса / контрагент', 'Клиент', 'Тип', 'Дата начала', 'Дата окончания', 'Премия', 'Статус платежа'].map(
                (header, index) => {
                  const keys: SortKeys[] = [
                    'policyNumber',
                    'clientName',
                    'type',
                    'startDate',
                    'endDate',
                    'policyPremium',
                    'paymentStatusInfo',
                  ];
                  const key = keys[index];
                  return (
                    <th
                      key={header}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    >
                      <button
                        onClick={() => requestSort(key)}
                        className="flex items-center w-full text-left focus:outline-none"
                      >
                        {header}
                        <SortIcon direction={getSortDirection(key)} />
                      </button>
                    </th>
                  );
                },
              )}
            </tr>
            <tr className="bg-slate-100">
              <th className="p-2 font-normal" colSpan={2}></th>
              <th className="p-2 font-normal">
                <select
                  name="type"
                  onChange={handleFilterChange}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                >
                  <option value="all">Все</option>
                  {uniquePolicyTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </th>
              <th className="p-2 font-normal">
                <input
                  type="date"
                  name="startDate"
                  onChange={handleFilterChange}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                />
              </th>
              <th className="p-2 font-normal">
                <input
                  type="date"
                  name="endDate"
                  onChange={handleFilterChange}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                />
              </th>
              <th className="p-2 font-normal" />
              <th className="p-2 font-normal">
                <select
                  name="paymentStatus"
                  value={filters.paymentStatus}
                  onChange={handleFilterChange}
                  className="w-full text-sm p-1 border border-slate-300 rounded-md"
                >
                  {paymentStatusFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredAndSortedPolicies.map((policy) => (
              <tr
                key={policy.id}
                className={policy.isDueForRenewal ? 'bg-yellow-50 hover:bg-yellow-100/70' : 'hover:bg-slate-50'}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="font-medium text-slate-900">{policy.policyNumber}</div>
                  <div className="text-slate-500">{policy.counterparty}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{policy.clientName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{policy.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{policy.startDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{policy.endDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">
                  {formatCurrency(policy.policyPremium)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <PaymentStatusBadge statusInfo={policy.paymentStatusInfo} />
                    {policy.isDueForRenewal && policy.daysUntilRenewal !== null && (
                      <span className="text-xs text-orange-600 font-medium">
                        Продление через {policy.daysUntilRenewal} {getDaysNoun(policy.daysUntilRenewal)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAndSortedPolicies.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            Полисы, подходящие под фильтры, не найдены.
          </p>
        )}
      </div>
    </div>
  );
};

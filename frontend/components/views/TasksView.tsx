import React, { useState, useMemo } from 'react';
import { Deal, Client, Policy, Task } from '../../types';

interface TasksViewProps {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
  tasks: Task[];
}

interface EnrichedTask {
  id: string;
  description: string;
  assignee: string;
  completed: boolean;
  dueDate?: string;
  dealTitle: string;
  clientName: string;
}

const RENEWAL_REMINDER_DAYS = 30;

const formatAssignee = (value?: string | null) => value?.trim() || 'Не назначен';
const formatDueDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

const TaskCard: React.FC<{ task: EnrichedTask }> = ({ task }) => {
  const assigneeLabel = formatAssignee(task.assignee);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex items-start space-x-4">
      <input
        type="checkbox"
        defaultChecked={task.completed}
        className="h-5 w-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 mt-1"
        disabled
      />
      <div className="flex-1">
        <p className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
          {task.description}
        </p>
        <div className="text-sm text-slate-500 mt-1">
          {task.dealTitle !== 'Продление полиса' && (
            <>
              <span>Сделка: </span>
              <span className="font-semibold text-sky-700">{task.dealTitle}</span>
              <span className="mx-2">&middot;</span>
            </>
          )}
          <span>{task.clientName}</span>
        </div>
        <div className="text-xs text-slate-400 mt-2 flex items-center space-x-4">
          <span
            className={`font-bold px-2 py-0.5 rounded-full ${
              assigneeLabel.toLowerCase().includes('продавец')
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            }`}
          >
            {assigneeLabel}
          </span>
          <span>Срок: {formatDueDate(task.dueDate)}</span>
        </div>
      </div>
    </div>
  );
};

export const TasksView: React.FC<TasksViewProps> = ({ deals, clients, policies, tasks }) => {
  const [filters, setFilters] = useState({ assignee: 'all', clientName: '' });
  const [sortBy, setSortBy] = useState('dueDate-asc');

  const combinedTasks = useMemo<EnrichedTask[]>(() => {
    // Генерируем напоминания о продлении полисов
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderLimit = new Date(today);
    reminderLimit.setDate(today.getDate() + RENEWAL_REMINDER_DAYS);

    const renewalReminders = policies
      .filter((policy) => {
        const rawEndDate =
          (policy as any).effectiveTo ??
          (policy as any).effective_to ??
          policy.endDate;
        if (!rawEndDate) {
          return false;
        }
        const endDate = new Date(rawEndDate);
        return endDate >= today && endDate <= reminderLimit;
      })
      .map((policy) => ({
        id: `reminder-${policy.id}`,
        description: `Подготовить продление полиса №${policy.policyNumber}`,
        completed: false,
        assignee: deals.find((d) => d.id === policy.dealId)?.owner || '',
        dueDate:
          (policy as any).effectiveTo ??
          (policy as any).effective_to ??
          policy.endDate,
        dealTitle: 'Продление полиса',
        clientName: clients.find((c) => c.id === policy.clientId)?.name || 'N/A',
      }));

    // Преобразуем задачи из API
    const apiTasks: EnrichedTask[] = tasks
      .map((task) => {
        const deal = task.dealId ? deals.find((d) => d.id === task.dealId) : undefined;
        if (!deal) {
          return null;
        }

        const client =
          (task.clientId && clients.find((c) => c.id === task.clientId)) ||
          clients.find((c) => c.id === deal.clientId);

        const description =
          task.description || task.title || 'Задача без описания';
        const dueDate = task.dueDate || task.dueAt || task.scheduledFor;
        const completed =
          task.completed ??
          task.status === 'completed' ??
          task.statusCode === 'completed';

        return {
          id: task.id || `task-${Math.random().toString(36).slice(2)}`,
          description,
          assignee: task.assigneeName || task.assignee || '',
          completed: Boolean(completed),
          dueDate,
          dealTitle: deal.title,
          clientName: client?.name || 'N/A',
        };
      })
      .filter((task): task is EnrichedTask => task !== null);

    return [...renewalReminders, ...apiTasks];
  }, [deals, clients, policies, tasks]);

  const uniqueAssignees = useMemo(
    () =>
      [...new Set(combinedTasks.map((t) => formatAssignee(t.assignee)))]
        .sort()
        .map((label) => label),
    [combinedTasks],
  );

  const filteredTasks = useMemo(() => {
    let result = [...combinedTasks];

    if (filters.assignee !== 'all') {
      result = result.filter(
        (task) => formatAssignee(task.assignee) === filters.assignee,
      );
    }

    const search = filters.clientName.trim().toLowerCase();
    if (search) {
      result = result.filter(
        (task) =>
          task.clientName.toLowerCase().includes(search) ||
          task.dealTitle.toLowerCase().includes(search) ||
          task.description.toLowerCase().includes(search),
      );
    }

    result.sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;

      if (sortBy === 'dueDate-desc') {
        return dateB - dateA;
      }
      return dateA - dateB;
    });

    return result;
  }, [combinedTasks, filters, sortBy]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <header className="sticky top-0 bg-slate-50/90 backdrop-blur border-b border-slate-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Задачи ({filteredTasks.length})
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Личные задачи менеджеров и автоматические напоминания о продлении полисов
        </p>
      </header>

      <div className="px-8 py-6 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="task-user-filter" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Ответственный
            </label>
            <select
              id="task-user-filter"
              value={filters.assignee}
              onChange={(e) => setFilters((prev) => ({ ...prev, assignee: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Все</option>
              {uniqueAssignees.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="task-search" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Поиск по клиенту или сделке
            </label>
            <input
              id="task-search"
              type="text"
              value={filters.clientName}
              onChange={(e) => setFilters((prev) => ({ ...prev, clientName: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Например: Иванов / ОСАГО / Перезвонить"
            />
          </div>
          <div>
            <label htmlFor="task-sort" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Сортировка
            </label>
            <select
              id="task-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="dueDate-asc">По сроку (сначала ближайшие)</option>
              <option value="dueDate-desc">По сроку (сначала поздние)</option>
            </select>
          </div>
        </div>

        <section className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500">
              Задачи, подходящие под выбранные фильтры, не найдены.
            </div>
          ) : (
            filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </section>
      </div>
    </div>
  );
};

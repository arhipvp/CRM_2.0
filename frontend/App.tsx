/**
 * Основной компонент приложения с роутингом и проверкой аутентификации
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { MainLayout } from './components/MainLayout';
import { DealsView } from './components/views/DealsView';
import { ClientsView } from './components/views/ClientsView';
import { PoliciesView } from './components/views/PoliciesView';
import { PaymentsView } from './components/views/PaymentsView';
import { FinanceView } from './components/views/FinanceView';
import { TasksView } from './components/views/TasksView';
import { SettingsView } from './components/views/SettingsView';
import { AddDealForm } from './components/AddDealForm';
import { AddClientForm } from './components/AddClientForm';
import { EditClientForm } from './components/EditClientForm';
import {
  Client,
  ClientCreateInput,
  ClientUpdateInput,
  Deal,
  Policy,
  Payment,
  FinancialTransaction,
  DealStatus,
  Quote,
  Task,
} from './types';
import * as crmApi from './services/crmApi';
import { loadDataWithFallback, createDealWithFallback, createClientWithFallback, createPolicyWithFallback, createPaymentWithFallback, updateClientWithFallback } from './services/dataLoader';
import { normalizePaymentStatus } from './utils/paymentStatus';

type View = 'deals' | 'clients' | 'policies' | 'payments' | 'finance' | 'tasks' | 'settings';
type Modal = 'addDeal' | 'addClient' | { type: 'editClient'; client: Client } | null;

const AVAILABLE_VIEWS: View[] = ['deals', 'clients', 'policies', 'payments', 'finance', 'tasks', 'settings'];

const resolveView = (value?: string): View => {
  if (!value) {
    return 'deals';
  }
  return AVAILABLE_VIEWS.includes(value as View) ? (value as View) : 'deals';
};

const LoadingScreen: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-screen bg-slate-100 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

/**
 * Компонент, защищающий приватные маршруты
 */
const RequireAuth: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Проверяю аутентификацию..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

/**
 * Основной layout авторизованной части приложения
 */
const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { view: viewParam } = useParams<{ view?: string }>();
  const currentView = useMemo(() => resolveView(viewParam), [viewParam]);

  /**
   * Если маршрут не указан или некорректен — перенаправляем на /deals
   */
  useEffect(() => {
    if (!viewParam) {
      navigate('/deals', { replace: true });
    } else if (!AVAILABLE_VIEWS.includes(viewParam as View)) {
      navigate('/deals', { replace: true });
    }
  }, [viewParam, navigate]);

  const [modal, setModal] = useState<Modal>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const ALL_USERS = useMemo(
    () => [...new Set(deals.map((deal) => deal.owner).filter(Boolean))],
    [deals],
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await loadDataWithFallback();

        setClients(data.clients);

        const normalizedDeals: Deal[] = data.deals.map((deal) => ({
          ...deal,
          tasks: deal.tasks ?? [],
          notes: deal.notes ?? [],
          quotes: deal.quotes ?? [],
          files: deal.files ?? [],
          chat: deal.chat ?? [],
          activityLog: deal.activityLog ?? [],
        }));

        setDeals(normalizedDeals);
        setPolicies(data.policies);

        const normalizedPayments = data.payments.map((payment) => ({
          ...payment,
          status: normalizePaymentStatus(payment.status),
        }));

        setPayments(normalizedPayments);
        setFinancialTransactions(data.financialTransactions);
        setTasks(data.tasks);

        if (data.isMocked) {
          console.warn('[App] Using mock data - backend API is not available');
          setError('⚠️ Данные из demo режима (backend недоступен)');
        }

        if (normalizedDeals.length > 0) {
          setSelectedDealId(normalizedDeals[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load data:', err);
        setError('Ошибка загрузки данных.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleNavigate = (view: View) => {
    navigate(view === 'deals' ? '/deals' : `/${view}`);
  };

  const selectedDeal = useMemo(() => {
    if (!selectedDealId) return null;
    return deals.find((d) => d.id === selectedDealId) || null;
  }, [selectedDealId, deals]);

  const handleSelectDeal = (deal: Deal) => setSelectedDealId(deal.id);

  const handleUpdateReviewDate = (dealId: string, newDate: string) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) => (d.id === dealId ? { ...d, nextReviewDate: newDate } : d)),
    );
  };

  const handleUpdateDealStatus = (dealId: string, newStatus: DealStatus, reason?: string) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) => {
        if (d.id !== dealId) return d;
        const newDeal = { ...d, status: newStatus };
        if (newStatus === 'Закрыта' && reason) {
          const newNote = {
            id: `note-${Date.now()}`,
            content: `Сделка закрыта. Причина: ${reason}`,
            createdAt: new Date().toLocaleDateString('ru-RU'),
            status: 'archived' as const,
          };
          newDeal.notes = [...newDeal.notes, newNote];
        }
        return newDeal;
      }),
    );
  };

  const handleUpdateDealTitle = (dealId: string, newTitle: string) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) => (d.id === dealId ? { ...d, title: newTitle } : d)),
    );
  };

  const handleUpdateDealClient = (dealId: string, clientId: string) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) => (d.id === dealId ? { ...d, clientId } : d)),
    );
  };

  const handleAddNote = (dealId: string, content: string) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              notes: [
                ...(d.notes ?? []),
                {
                  id: `note-${Date.now()}`,
                  content,
                  createdAt: new Date().toLocaleDateString('ru-RU'),
                  status: 'active' as const,
                },
              ],
            }
          : d,
      ),
    );
  };

  const onUpdateNoteStatus = (dealId: string, noteId: string, status: 'active' | 'archived') => {
    setDeals((prevDeals) =>
      prevDeals.map((d) => {
        if (d.id !== dealId) return d;
        return {
          ...d,
          notes: (d.notes ?? []).map((note) =>
            note.id === noteId ? { ...note, status } : note,
          ),
        };
      }),
    );
  };

  const handleAddQuote = (dealId: string, quoteData: Omit<Quote, 'id'>) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) =>
        d.id === dealId
          ? { ...d, quotes: [...(d.quotes ?? []), { ...quoteData, id: `quote-${Date.now()}` }] }
          : d,
      ),
    );
  };

  const handleDeleteQuote = (dealId: string, quoteId: string) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) =>
        d.id === dealId
          ? { ...d, quotes: (d.quotes ?? []).filter((quote) => quote.id !== quoteId) }
          : d,
      ),
    );
  };

  const handleAddFile = (dealId: string, file: File) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) =>
        d.id === dealId
          ? {
              ...d,
              files: [
                ...(d.files ?? []),
                {
                  id: `file-${Date.now()}`,
                  name: file.name,
                  size: file.size,
                  url: '#',
                },
              ],
            }
          : d,
      ),
    );
  };

  const handleDeleteFile = (dealId: string, fileId: string) => {
    setDeals((prevDeals) =>
      prevDeals.map((d) =>
        d.id === dealId
          ? { ...d, files: (d.files ?? []).filter((file) => file.id !== fileId) }
          : d,
      ),
    );
  };

  const handleAddPolicy = async (
    dealId: string,
    policyData: Omit<Policy, 'id' | 'clientId' | 'dealId'>,
    installments: Array<Omit<Payment, 'id' | 'clientId' | 'policyId' | 'status'>>,
    policyClientId: string,
  ) => {
    try {
      const createdPolicy = await crmApi.createPolicy({
        ...policyData,
        clientId: policyClientId,
        dealId,
      });

      setPolicies((prev) => [createdPolicy, ...prev]);

      if (installments.length > 0) {
        const createdPayments = await Promise.all(
          installments.map((inst) =>
            crmApi.createPayment(dealId, createdPolicy.id, inst),
          ),
        );

        setPayments((prev) => [
          ...prev,
          ...createdPayments.map((payment) => ({
            ...payment,
            status: normalizePaymentStatus(payment.status),
          })),
        ]);
      }
    } catch (error) {
      console.error('Failed to create policy:', error);
      throw error;
    }
  };

  const handleAddPayment = async (
    policyId: string,
    paymentData: Omit<Payment, 'id' | 'policyId' | 'clientId'>,
  ) => {
    const policy = policies.find((p) => p.id === policyId);
    if (!policy || !policy.dealId) {
      throw new Error('Не удалось определить сделку для выбранного полиса.');
    }

    try {
      const createdPayment = await crmApi.createPayment(policy.dealId, policyId, paymentData);

      setPayments((prev) => [
        ...prev,
        {
          ...createdPayment,
          status: normalizePaymentStatus(createdPayment.status),
        },
      ]);
    } catch (error) {
      console.error('Failed to create payment:', error);
      throw error;
    }
  };

  const handleAddTask = async (dealId: string, taskData: Omit<Task, 'id' | 'completed'>) => {
    const relatedDeal = deals.find((d) => d.id === dealId);
    try {
      const payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'> = {
        ...taskData,
        dealId,
        clientId: taskData.clientId ?? relatedDeal?.clientId,
        title: taskData.title ?? taskData.description ?? 'Задача',
        description: taskData.description,
        assignee: taskData.assignee,
        assigneeName: taskData.assignee,
        dueDate: taskData.dueDate,
        scheduledFor: taskData.scheduledFor,
        status: 'open',
      };

      const createdTask = await crmApi.createTask(payload);
      setTasks((prev) => [createdTask, ...prev]);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  };

  const handleToggleTask = async (dealId: string, taskId: string) => {
    const existingTask = tasks.find((task) => task.id === taskId);
    if (!existingTask) {
      return;
    }

    const nextCompleted = !existingTask.completed;

    try {
      const updatedTask = await crmApi.updateTask(taskId, {
        completed: nextCompleted,
        status: nextCompleted ? 'completed' : 'open',
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updatedTask : task)));
    } catch (error) {
      console.error(`Failed to toggle task ${taskId}:`, error);
      throw error;
    }
  };

  const handleAddFinancialTransaction = (transactionData: Omit<FinancialTransaction, 'id'>) => {
    const newTransaction = { ...transactionData, id: `fin-${Date.now()}` };
    setFinancialTransactions((prev) => [...prev, newTransaction]);
  };

  const handleAddChatMessage = (dealId: string, text: string) => {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const newMessage = {
          id: `chat-${Date.now()}`,
          text,
          sender: 'Пользователь',
          timestamp: new Date().toISOString(),
        };
        return { ...d, chat: [...(d.chat ?? []), newMessage] };
      }),
    );
  };

  const handleMarkAsPaid = (transactionId: string, paymentDate: string) => {
    setFinancialTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, paymentDate } : t)),
    );
  };

  const handleUpdateAmount = (transactionId: string, newAmount: number) => {
    setFinancialTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, amount: newAmount } : t)),
    );
  };

  const handleSelectDealFromClientView = (dealId: string) => {
    setSelectedDealId(dealId);
    navigate('/deals');
  };

  const handleAddClient = async (clientData: ClientCreateInput) => {
    const createdClient = await crmApi.createClient(clientData);
    setClients((prev) => [createdClient, ...prev]);
  };

  const handleUpdateClient = async (clientId: string, updates: ClientUpdateInput) => {
    const updatedClient = await crmApi.updateClient(clientId, updates);
    setClients((prev) => prev.map((c) => (c.id === clientId ? updatedClient : c)));
  };

  const handleAddDeal = (data: { title: string; clientId: string }) => {
    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      title: data.title,
      clientId: data.clientId,
      status: 'Новая' as DealStatus,
      owner: 'Продавец 1',
      summary: 'Новая сделка, детали не заполнены.',
      nextReviewDate: new Date().toISOString().split('T')[0],
      tasks: [],
      notes: [],
      quotes: [],
      files: [],
      chat: [],
      activityLog: [],
      description: '',
      ownerId: null,
      nextReviewAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    setDeals((prev) => [newDeal, ...prev]);
    setSelectedDealId(newDeal.id);
    setModal(null);
    navigate('/deals');
  };

  const renderView = (view: View) => {
    switch (view) {
      case 'deals':
        return (
          <DealsView
            deals={deals}
            clients={clients}
            policies={policies}
            tasks={tasks}
            payments={payments}
            financialTransactions={financialTransactions}
            selectedDeal={selectedDeal}
            allUsers={ALL_USERS}
            onSelectDeal={handleSelectDeal}
            onUpdateReviewDate={handleUpdateReviewDate}
            onUpdateDealStatus={handleUpdateDealStatus}
            onUpdateDealOwner={() => {}}
            onUpdateDealTitle={handleUpdateDealTitle}
            onUpdateDealClient={handleUpdateDealClient}
            onAddNote={handleAddNote}
            onUpdateNoteStatus={onUpdateNoteStatus}
            onAddQuote={handleAddQuote}
            onDeleteQuote={handleDeleteQuote}
            onAddFile={handleAddFile}
            onDeleteFile={handleDeleteFile}
            onAddPolicy={handleAddPolicy}
            onAddPayment={handleAddPayment}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onAddFinancialTransaction={handleAddFinancialTransaction}
            onAddChatMessage={handleAddChatMessage}
          />
        );
      case 'clients':
        return (
          <ClientsView
            clients={clients}
            deals={deals}
            onEditClient={(client) => setModal({ type: 'editClient', client })}
            onSelectDeal={handleSelectDealFromClientView}
          />
        );
      case 'policies':
        return <PoliciesView policies={policies} clients={clients} payments={payments} />;
      case 'payments':
        return <PaymentsView payments={payments} policies={policies} clients={clients} />;
      case 'finance':
        return (
          <FinanceView
            financialTransactions={financialTransactions}
            policies={policies}
            deals={deals}
            clients={clients}
            onMarkAsPaid={handleMarkAsPaid}
            onUpdateAmount={handleUpdateAmount}
          />
        );
      case 'tasks':
        return <TasksView deals={deals} clients={clients} policies={policies} tasks={tasks} />;
      case 'settings':
        return <SettingsView />;
      default:
        return <div>Not found</div>;
    }
  };

  const renderModal = () => {
    if (!modal) return null;
    if (modal === 'addDeal')
      return <AddDealForm clients={clients} onAddDeal={handleAddDeal} onClose={() => setModal(null)} />;
    if (modal === 'addClient')
      return <AddClientForm onAddClient={handleAddClient} onClose={() => setModal(null)} />;
    if (typeof modal === 'object' && modal.type === 'editClient')
      return (
        <EditClientForm
          client={modal.client}
          onUpdateClient={handleUpdateClient}
          onClose={() => setModal(null)}
        />
      );
    return null;
  };

  if (loading) {
    return <LoadingScreen message="Загружаю данные..." />;
  }

  if (error) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white p-6 rounded-lg shadow-lg max-w-md">
          <p className="text-red-600 font-semibold mb-2">⚠️ Ошибка</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2"
          >
            Попробовать снова
          </button>
          <button
            onClick={() => logout()}
            className="bg-slate-500 text-white px-4 py-2 rounded hover:bg-slate-600"
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-100 font-sans">
      <MainLayout
        activeView={currentView}
        onNavigate={handleNavigate}
        onAddDeal={() => setModal('addDeal')}
        onAddClient={() => setModal('addClient')}
      >
        {renderView(currentView)}
      </MainLayout>
      {renderModal()}
    </div>
  );
};

/**
 * Отрисовка маршрутов приложения
 */
const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<RequireAuth />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/:view" element={<Dashboard />} />
    </Route>
    <Route path="*" element={<Navigate to="/deals" replace />} />
  </Routes>
);

/**
 * Точка входа приложения
 */
const App: React.FC = () => (
  <AuthProvider>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </Router>
  </AuthProvider>
);

export default App;

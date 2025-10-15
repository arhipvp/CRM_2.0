import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaymentCard } from "./PaymentCard";
import type { Payment } from "@/types/crm";

const basePayment: Payment = {
  id: "payment-story",
  dealId: "deal-1",
  dealName: "Демо-сделка",
  clientId: "client-1",
  clientName: "Клиент Историй",
  policyId: "policy-1",
  policyNumber: "CR-123",
  sequence: 1,
  amount: 100000,
  plannedAmount: 100000,
  currency: "RUB",
  status: "planned",
  confirmationStatus: "pending",
  actualAmount: 95000,
  paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  plannedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  actualDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  comment: "Платёж клиента за полис с дополнительной скидкой",
  incomesTotal: 95000,
  expensesTotal: 12000,
  netTotal: 83000,
  incomes: [
    {
      id: "income-1",
      paymentId: "payment-story",
      amount: 95000,
      plannedAmount: 100000,
      actualAmount: 95000,
      currency: "RUB",
      category: "Комиссия",
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      actualPostedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      note: "Поступление комиссии",
      status: "confirmed",
      adjustmentReason: null,
      attachments: [
        {
          id: "attach-income-1",
          fileName: "Акт выполненных работ.pdf",
          fileSize: 1024 * 550,
          uploadedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          uploadedBy: "Мария Савельева",
          url: "https://example.com/act.pdf",
        },
      ],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Мария Савельева",
      updatedBy: "Мария Савельева",
    },
  ],
  expenses: [
    {
      id: "expense-1",
      paymentId: "payment-story",
      amount: 12000,
      plannedAmount: 12000,
      actualAmount: 12000,
      currency: "RUB",
      category: "Бонус агенту",
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      actualPostedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      status: "confirmed",
      note: "Выплата бонуса за продажу",
      adjustmentReason: null,
      attachments: [
        {
          id: "attach-expense-1",
          fileName: "Платёжное поручение.pdf",
          fileSize: 1024 * 230,
          uploadedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          uploadedBy: "Сергей Петров",
          url: "https://example.com/payment-order.pdf",
        },
      ],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Сергей Петров",
      updatedBy: "Сергей Петров",
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  recordedBy: "Анна Орлова",
  recordedByRole: "Финансовый контролёр",
  updatedBy: "Анна Орлова",
  history: [
    {
      id: "change-1",
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      changedBy: "Анна Орлова",
      reason: "Согласован перенос даты оплаты",
      snapshot: {
        plannedAmount: 100000,
        actualAmount: 95000,
        plannedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        actualDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        status: "planned",
      },
    },
    {
      id: "change-2",
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      changedBy: "Сергей Петров",
      reason: "Фиксация фактической оплаты",
      snapshot: {
        plannedAmount: 100000,
        actualAmount: 95000,
        plannedDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        actualDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        status: "received",
      },
    },
  ],
};

const meta: Meta<typeof PaymentCard> = {
  title: "CRM/PaymentCard",
  component: PaymentCard,
  args: {
    expanded: true,
    onToggle: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onAddIncome: () => {},
    onAddExpense: () => {},
    onEditIncome: () => {},
    onDeleteIncome: () => {},
    onConfirmIncome: () => {},
    onEditExpense: () => {},
    onDeleteExpense: () => {},
    onConfirm: () => {},
    onRevokeConfirmation: () => {},
    onConfirmExpense: () => {},
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof PaymentCard>;

export const WithHistoryAndDocuments: Story = {
  args: {
    payment: basePayment,
  },
  parameters: {
    docs: {
      description: {
        story: "Карточка платежа показывает таймлайн изменений и прикреплённые документы из поступлений и расходов.",
      },
    },
  },
};

export const EmptyHistoryAndDocuments: Story = {
  args: {
    payment: {
      ...basePayment,
      id: "payment-story-empty",
      incomes: basePayment.incomes.map((income) => ({
        ...income,
        id: `${income.id}-empty`,
        attachments: [],
      })),
      expenses: basePayment.expenses.map((expense) => ({
        ...expense,
        id: `${expense.id}-empty`,
        attachments: [],
      })),
      history: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Пустые состояния отображают подсказки при отсутствии истории изменений и вложений.",
      },
    },
  },
};

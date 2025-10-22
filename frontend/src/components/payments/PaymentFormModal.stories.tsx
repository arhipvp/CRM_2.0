import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaymentFormModal } from "./PaymentFormModal";
import type { Payment } from "@/types/crm";

const samplePayment: Payment = {
  id: "payment-edit-story",
  dealId: "deal-story",
  dealName: "Сделка для демонстрации",
  clientId: "client-story",
  clientName: "Клиент истории",
  policyId: "policy-story",
  policyNumber: "CR-STORY",
  sequence: 1,
  amount: 75000,
  plannedAmount: 75000,
  currency: "RUB",
  status: "planned",
  confirmationStatus: "pending",
  dueDate: new Date().toISOString(),
  plannedDate: new Date().toISOString(),
  actualDate: undefined,
  comment: "Корректировка условий перед выпуском",
  incomesTotal: 0,
  expensesTotal: 0,
  netTotal: 0,
  incomes: [],
  expenses: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  recordedBy: "Анна Савельева",
  recordedByRole: "Главный админ",
  updatedBy: "Анна Савельева",
  paidAt: undefined,
  actualAmount: undefined,
  history: [
    {
      id: "hist-1",
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      changedBy: "Мария Орлова",
      reason: "Первоначальная договорённость",
      snapshot: {
        plannedAmount: 70000,
        actualAmount: undefined,
        plannedDate: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        actualDate: undefined,
        status: "planned",
      },
    },
  ],
};

const meta: Meta<typeof PaymentFormModal> = {
  title: "CRM/PaymentFormModal",
  component: PaymentFormModal,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof PaymentFormModal>;

export const EditRequiresReason: Story = {
  render: () => {
    const [reason, setReason] = useState("");
    return (
      <PaymentFormModal
        mode="edit"
        isOpen
        onClose={() => {}}
        onSubmit={async () => {}}
        isSubmitting={false}
        payment={samplePayment}
        dealOptions={[{ value: samplePayment.dealId, label: samplePayment.dealName ?? samplePayment.dealId }]}
        clientOptions={[{ value: samplePayment.clientId, label: samplePayment.clientName ?? samplePayment.clientId }]}
        editContext={{
          reason,
          onReasonChange: setReason,
          history: samplePayment.history,
          summary: {
            plannedAmount: samplePayment.plannedAmount,
            actualAmount: samplePayment.actualAmount,
            incomesTotal: samplePayment.incomesTotal,
            expensesTotal: samplePayment.expensesTotal,
            netTotal: samplePayment.netTotal,
          },
        }}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Форма редактирования показывает поле причины изменения и историю версий. Кнопка сохранения отключена, пока причина не заполнена.",
      },
    },
  },
};

export const EditWithCurrencyChange: Story = {
  render: () => {
    const [reason, setReason] = useState("Корректировка валюты платежа для международного перевода.");

    return (
      <PaymentFormModal
        mode="edit"
        isOpen
        onClose={() => {}}
        onSubmit={async () => {}}
        isSubmitting={false}
        payment={{ ...samplePayment, currency: "RUB" }}
        dealOptions={[{ value: samplePayment.dealId, label: samplePayment.dealName ?? samplePayment.dealId }]}
        clientOptions={[{ value: samplePayment.clientId, label: samplePayment.clientName ?? samplePayment.clientId }]}
        editContext={{
          reason,
          onReasonChange: setReason,
          history: samplePayment.history,
          summary: {
            plannedAmount: samplePayment.plannedAmount,
            actualAmount: samplePayment.actualAmount,
            incomesTotal: samplePayment.incomesTotal,
            expensesTotal: samplePayment.expensesTotal,
            netTotal: samplePayment.netTotal,
          },
        }}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Измените валюту в выпадающем списке, чтобы увидеть уведомление о несоответствии. История и сводка остаются в исходной валюте, пока изменения не сохранены.",
      },
    },
  },
};

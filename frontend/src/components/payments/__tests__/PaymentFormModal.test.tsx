import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PaymentFormModal } from "@/components/payments/PaymentFormModal";
import type { Payment } from "@/types/crm";

describe("PaymentFormModal", () => {
  const basePayment: Payment = {
    id: "payment-1",
    dealId: "deal-1",
    dealName: "Сделка 1",
    clientId: "client-1",
    clientName: "Клиент 1",
    policyId: "policy-1",
    policyNumber: "CR-1",
    sequence: 1,
    amount: 100000,
    plannedAmount: 100000,
    currency: "RUB",
    status: "planned",
    confirmationStatus: "pending",
    dueDate: new Date().toISOString(),
    plannedDate: new Date().toISOString(),
    actualDate: undefined,
    comment: "",
    incomesTotal: 50000,
    expensesTotal: 10000,
    netTotal: 40000,
    incomes: [],
    expenses: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recordedBy: "Алексей Петров",
    recordedByRole: "Менеджер",
    updatedBy: "Алексей Петров",
    paidAt: undefined,
    actualAmount: undefined,
    history: [],
  };

  it("оставляет сводку в исходной валюте до сохранения изменений", async () => {
    const user = userEvent.setup();

    render(
      <PaymentFormModal
        mode="edit"
        isOpen
        onClose={() => {}}
        onSubmit={async () => {}}
        payment={basePayment}
        dealOptions={[{ value: basePayment.dealId, label: basePayment.dealName ?? basePayment.dealId }]}
        clientOptions={[{ value: basePayment.clientId, label: basePayment.clientName ?? basePayment.clientId }]}
        editContext={{
          reason: "Обновление валюты",
          onReasonChange: () => {},
          history: basePayment.history,
          summary: {
            plannedAmount: basePayment.plannedAmount,
            actualAmount: basePayment.actualAmount,
            incomesTotal: basePayment.incomesTotal,
            expensesTotal: basePayment.expensesTotal,
            netTotal: basePayment.netTotal,
          },
        }}
      />,
    );

    const currencySelect = screen.getByDisplayValue("RUB");
    await user.selectOptions(currencySelect, "USD");

    expect(screen.getByText(/Сводка показана в валюте RUB/i)).toBeInTheDocument();
    expect(screen.getByText(/Текущие значения сводки отображаются в исходной валюте RUB/i)).toBeInTheDocument();
  });
});

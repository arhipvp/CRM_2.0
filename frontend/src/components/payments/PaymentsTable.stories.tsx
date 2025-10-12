import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PaymentsTable } from "./PaymentsTable";
import { paymentsMock } from "@/mocks/data";
import { paymentsQueryOptions } from "@/lib/api/queries";

const meta: Meta<typeof PaymentsTable> = {
  title: "CRM/PaymentsTable",
  component: PaymentsTable,
  parameters: {
    docs: {
      description: {
        component: "Отчёт по платежам: docs/frontend/payments.md",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof PaymentsTable>;

const Template = () => {
  const client = useQueryClient();
  useEffect(() => {
    client.setQueryData(paymentsQueryOptions().queryKey, paymentsMock);
  }, [client]);

  return <PaymentsTable />;
};

export const Default: Story = {
  render: () => <Template />,
};

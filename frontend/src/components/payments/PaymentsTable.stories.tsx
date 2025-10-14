import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PaymentsTable } from "./PaymentsTable";
import { paymentsMock } from "@/mocks/data";
import { paymentsQueryOptions } from "@/lib/api/queries";

const paymentsKey = paymentsQueryOptions({ include: ["incomes", "expenses"] }).queryKey;

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

interface StoryTemplateProps {
  setup?: (client: ReturnType<typeof useQueryClient>) => void;
}

const Template = ({ setup }: StoryTemplateProps) => {
  const client = useQueryClient();

  useEffect(() => {
    setup?.(client);
    return () => {
      client.removeQueries({ queryKey: paymentsKey });
    };
  }, [client, setup]);

  return <PaymentsTable />;
};

export const Default: Story = {
  render: () => (
    <Template
      setup={(client) => {
        client.setQueryData(paymentsKey, paymentsMock);
      }}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <Template
      setup={(client) => {
        client.setQueryDefaults(paymentsKey, {
          queryFn: () => new Promise<never>(() => {}),
        });
        client.removeQueries({ queryKey: paymentsKey });
      }}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <Template
      setup={(client) => {
        client.setQueryData(paymentsKey, []);
      }}
    />
  ),
};

export const Error: Story = {
  render: () => (
    <Template
      setup={(client) => {
        client.setQueryDefaults(paymentsKey, {
          queryFn: async () => {
            throw new Error("Сервис платежей недоступен");
          },
        });
        client.removeQueries({ queryKey: paymentsKey });
      }}
    />
  ),
};

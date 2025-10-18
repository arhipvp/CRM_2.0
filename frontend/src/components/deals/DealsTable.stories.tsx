import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DealsTable } from "./DealsTable";
import { dealsMock } from "@/mocks/data";
import { dealsQueryOptions } from "@/lib/api/queries";

const meta: Meta<typeof DealsTable> = {
  title: "CRM/DealsTable",
  component: DealsTable,
  parameters: {
    docs: {
      description: {
        component:
          "Таблица сделок с фильтрами и предпросмотром. Компонент показывает ближайшие обзоры и позволяет перейти в карточку сделки.",
      },
    },
  },
};

export default meta;

const WithMockedData = () => {
  const client = useQueryClient();

  useEffect(() => {
    client.setQueryData(dealsQueryOptions().queryKey, () => dealsMock);
  }, [client]);

  return <DealsTable />;
};

export const Overview: StoryObj<typeof DealsTable> = {
  render: () => <WithMockedData />,
};

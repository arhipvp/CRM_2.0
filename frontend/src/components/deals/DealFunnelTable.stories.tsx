import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DealFunnelTable } from "./DealFunnelTable";
import { dealsMock } from "@/mocks/data";
import { dealsQueryOptions } from "@/lib/api/queries";
import { useUiStore } from "@/stores/uiStore";

const meta: Meta<typeof DealFunnelTable> = {
  title: "CRM/DealFunnelTable",
  component: DealFunnelTable,
  parameters: {
    docs: {
      description: {
        component:
          "Табличный вид воронки сделок. В колонках отображаются ответственный менеджер и ожидаемая дата закрытия, как и в карточках. Стадия сделки выводится с локализованными названиями («Квалификация», «Переговоры» и т.д.).",
      },
    },
  },
};

export default meta;

const WithTableView = () => {
  const client = useQueryClient();

  useEffect(() => {
    client.setQueryData(dealsQueryOptions().queryKey, () => dealsMock);
  }, [client]);

  useEffect(() => {
    const store = useUiStore.getState();
    const previousViewMode = store.viewMode;
    store.setViewMode("table");

    return () => {
      useUiStore.getState().setViewMode(previousViewMode);
    };
  }, []);

  return <DealFunnelTable />;
};

export const Overview: StoryObj<typeof DealFunnelTable> = {
  render: () => <WithTableView />,
};

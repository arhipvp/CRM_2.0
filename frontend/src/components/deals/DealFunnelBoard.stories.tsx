import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DealFunnelBoard } from "./DealFunnelBoard";
import { dealsMock } from "@/mocks/data";
import { dealsQueryOptions } from "@/lib/api/queries";
import { useUiStore } from "@/stores/uiStore";

const meta: Meta<typeof DealFunnelBoard> = {
  title: "CRM/DealFunnelBoard",
  component: DealFunnelBoard,
  parameters: {
    docs: {
      description: {
        component:
          "См. спецификацию в docs/frontend/deal-funnel.md. Плавающая панель массовых действий появляется при выборе карточек.",
      },
    },
  },
};

export default meta;

const WithData = () => {
  const client = useQueryClient();
  useEffect(() => {
    client.setQueryData(dealsQueryOptions().queryKey, dealsMock);
  }, [client]);

  return <DealFunnelBoard />;
};

export const Overview: StoryObj<typeof DealFunnelBoard> = {
  render: () => <WithData />,
};

const WithBulkSelection = () => {
  const client = useQueryClient();

  useEffect(() => {
    client.setQueryData(dealsQueryOptions().queryKey, dealsMock);
  }, [client]);

  useEffect(() => {
    const previousState = useUiStore.getState();
    const previousViewMode = previousState.viewMode;
    const previousSelection = [...previousState.selectedDealIds];
    const defaultSelection = dealsMock.slice(0, 3).map((deal) => deal.id);

    useUiStore.setState({ selectedDealIds: defaultSelection, viewMode: "kanban" });

    return () => {
      useUiStore.setState({ selectedDealIds: previousSelection, viewMode: previousViewMode });
    };
  }, []);

  return <DealFunnelBoard />;
};

export const BulkActionsPanel: StoryObj<typeof DealFunnelBoard> = {
  name: "С панелью массовых действий",
  render: () => <WithBulkSelection />,
  parameters: {
    docs: {
      description: {
        story:
          "Стейт с активированной панелью массовых действий: выбрано несколько карточек, отображается плавающая панель внизу экрана.",
      },
    },
  },
};

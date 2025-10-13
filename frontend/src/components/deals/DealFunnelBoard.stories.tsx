import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DealFunnelBoard } from "./DealFunnelBoard";
import { dealsMock } from "@/mocks/data";
import { dealsQueryOptions } from "@/lib/api/queries";
import { useUiStore } from "@/stores/uiStore";

type UiStoreSnapshot = {
  filters: ReturnType<typeof useUiStore.getState>["filters"];
  viewMode: ReturnType<typeof useUiStore.getState>["viewMode"];
  selectedDealIds: ReturnType<typeof useUiStore.getState>["selectedDealIds"];
  previewDealId: ReturnType<typeof useUiStore.getState>["previewDealId"];
};

function snapshotUiStore(): UiStoreSnapshot {
  const state = useUiStore.getState();
  return {
    filters: {
      ...state.filters,
      managers: [...state.filters.managers],
    },
    viewMode: state.viewMode,
    selectedDealIds: [...state.selectedDealIds],
    previewDealId: state.previewDealId,
  };
}

function restoreUiStore(snapshot: UiStoreSnapshot) {
  useUiStore.setState((state) => ({
    ...state,
    filters: {
      ...snapshot.filters,
      managers: [...snapshot.filters.managers],
    },
    viewMode: snapshot.viewMode,
    selectedDealIds: [...snapshot.selectedDealIds],
    previewDealId: snapshot.previewDealId,
  }));
}

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
    const previousState = snapshotUiStore();
    const defaultSelection = dealsMock.slice(0, 3).map((deal) => deal.id);

    const store = useUiStore.getState();
    store.clearFilters();
    store.setViewMode("kanban");
    store.selectDeals(defaultSelection);

    return () => {
      restoreUiStore(previousState);
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

const WithActiveFilters = () => {
  const client = useQueryClient();

  useEffect(() => {
    client.setQueryData(dealsQueryOptions().queryKey, dealsMock);
  }, [client]);

  useEffect(() => {
    const previousState = snapshotUiStore();
    const owners = Array.from(new Set(dealsMock.map((deal) => deal.owner)));
    const store = useUiStore.getState();

    store.clearFilters();
    store.setViewMode("kanban");
    store.setSelectedStage("negotiation");
    store.setManagersFilter(owners.slice(0, 2));
    store.setPeriodFilter("7d");
    store.setSearchFilter("полис");

    return () => {
      restoreUiStore(previousState);
    };
  }, []);

  return <DealFunnelBoard />;
};

export const FiltersApplied: StoryObj<typeof DealFunnelBoard> = {
  name: "С активными фильтрами",
  render: () => <WithActiveFilters />,
  parameters: {
    docs: {
      description: {
        story:
          "Пример состояния с включёнными фильтрами по стадии, менеджерам, периоду и поисковому запросу. Панель сброса фильтров и счётчики отображают активные ограничения.",
      },
    },
  },
};

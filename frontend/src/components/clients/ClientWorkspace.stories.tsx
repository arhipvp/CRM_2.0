import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClientWorkspace } from "./ClientWorkspace";
import {
  activitiesMock,
  clientPoliciesMock,
  clientRemindersMock,
  clientTaskChecklistMock,
  clientsMock,
} from "@/mocks/data";
import {
  clientActivityQueryOptions,
  clientPoliciesQueryOptions,
  clientQueryOptions,
  clientRemindersQueryOptions,
  clientTasksChecklistQueryOptions,
} from "@/lib/api/queries";
import type { ActivityLogEntry, PaginatedResult } from "@/types/crm";

const meta: Meta<typeof ClientWorkspace> = {
  title: "CRM/ClientWorkspace",
  component: ClientWorkspace,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Карточка клиента и полиса: docs/frontend/client-policy-card.md",
      },
    },
  },
  args: {
    clientId: clientsMock[0].id,
  },
};

export default meta;

type Story = StoryObj<typeof ClientWorkspace>;

function seedActivity(clientId: string): PaginatedResult<ActivityLogEntry> {
  const items = activitiesMock
    .filter((entry) => entry.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageSize = 5;
  return {
    items: items.slice(0, pageSize),
    total: items.length,
    page: 1,
    pageSize,
  };
}

const Template: Story["render"] = ({ clientId = clientsMock[0].id }) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = clientsMock.find((item) => item.id === clientId);
    if (!client) {
      return;
    }

    queryClient.setQueryData(clientQueryOptions(clientId).queryKey, client);

    const activePolicies = clientPoliciesMock.filter((policy) => policy.clientId === clientId && !["archived", "cancelled", "expired"].includes(policy.status));
    const archivedPolicies = clientPoliciesMock.filter((policy) => policy.clientId === clientId && ["archived", "cancelled", "expired"].includes(policy.status));

    queryClient.setQueryData(clientPoliciesQueryOptions(clientId, { status: "active" }).queryKey, activePolicies);
    queryClient.setQueryData(clientPoliciesQueryOptions(clientId, { status: "archived" }).queryKey, archivedPolicies);
    queryClient.setQueryData(clientActivityQueryOptions(clientId, { page: 1, pageSize: 5 }).queryKey, seedActivity(clientId));

    const tasks = clientTaskChecklistMock.filter((task) => task.clientId === clientId);
    queryClient.setQueryData(clientTasksChecklistQueryOptions(clientId).queryKey, tasks);

    const reminders = clientRemindersMock.filter((reminder) => reminder.clientId === clientId);
    queryClient.setQueryData(clientRemindersQueryOptions(clientId).queryKey, reminders);
  }, [clientId, queryClient]);

  return <ClientWorkspace clientId={clientId} />;
};

export const Default: Story = {
  render: Template,
};

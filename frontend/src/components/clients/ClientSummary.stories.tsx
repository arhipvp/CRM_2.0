import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClientSummary } from "./ClientSummary";
import { clientsMock, activitiesMock } from "@/mocks/data";
import { clientActivityQueryOptions, clientQueryOptions } from "@/lib/api/queries";

const meta: Meta<typeof ClientSummary> = {
  title: "CRM/ClientSummary",
  component: ClientSummary,
  parameters: {
    docs: {
      description: {
        component: "Карточка клиента: docs/frontend/client-policy-card.md",
      },
    },
  },
  args: {
    clientId: clientsMock[0].id,
  },
};

export default meta;

type Story = StoryObj<typeof ClientSummary>;

const Template: NonNullable<Story["render"]> = ({
  clientId = clientsMock[0].id,
}) => {
  const client = useQueryClient();
  useEffect(() => {
    client.setQueryData(clientQueryOptions(clientId).queryKey, clientsMock[0]);
    client.setQueryData(
      clientActivityQueryOptions(clientId).queryKey,
      activitiesMock.filter((item) => item.clientId === clientId),
    );
  }, [client, clientId]);

  return <ClientSummary clientId={clientId} />;
};

export const Default: Story = {
  render: Template,
};

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DealFunnelBoard } from "./DealFunnelBoard";
import { dealsMock } from "@/mocks/data";
import { dealsQueryOptions } from "@/lib/api/queries";

const meta: Meta<typeof DealFunnelBoard> = {
  title: "CRM/DealFunnelBoard",
  component: DealFunnelBoard,
  parameters: {
    docs: {
      description: {
        component: "См. спецификацию в docs/frontend/deal-funnel.md",
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

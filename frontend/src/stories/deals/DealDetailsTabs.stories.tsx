import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DealDetails } from "@/components/deals/DealDetails";
import { OverviewTab } from "@/components/deals/details/OverviewTab";
import { DocumentsTab } from "@/components/deals/details/DocumentsTab";
import { PoliciesTab } from "@/components/deals/details/PoliciesTab";
import { JournalTab } from "@/components/deals/details/JournalTab";
import { dealDetailsMock } from "@/mocks/data";
import type { DealDetailsData } from "@/types/crm";

const deal = dealDetailsMock["deal-1"] satisfies DealDetailsData;

const meta: Meta = {
  title: "Deals/Deal Details",
};

export default meta;

type Story = StoryObj;

export const FullData: Story = {
  render: () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["deal", "deal-1", "details"], deal);
    return (
      <QueryClientProvider client={queryClient}>
        <DealDetails dealId="deal-1" />
      </QueryClientProvider>
    );
  },
};

export const OverviewEmpty: Story = {
  name: "Overview/Empty",
  render: () => (
    <OverviewTab
      deal={{
        ...deal,
        overview: {
          metrics: [],
          nextEvents: [],
          warnings: [],
          lastInteractions: [],
          confirmedPayments: [],
          currentPolicyId: undefined,
        },
        policies: [],
      }}
      onOpenPolicies={() => undefined}
    />
  ),
};

export const DocumentsEmpty: Story = {
  name: "Documents/Empty",
  render: () => <DocumentsTab categories={deal.documentsV2.map((category) => ({ ...category, documents: [] }))} />,
};

export const PoliciesEmpty: Story = {
  name: "Policies/Empty",
  render: () => <PoliciesTab policies={[]} />,
};

export const JournalEmpty: Story = {
  name: "Journal/Empty",
  render: () => <JournalTab activity={[]} />,
};

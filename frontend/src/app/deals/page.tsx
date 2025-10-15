import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { DealFunnelHeader } from "@/components/deals/DealFunnelHeader";
import { DealFunnelTable } from "@/components/deals/DealFunnelTable";
import { getServerApiClient } from "@/lib/api/client";
import { dealsQueryOptions, dealStageMetricsQueryOptions } from "@/lib/api/queries";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";

export const revalidate = 0;

export default async function DealsPage() {
  const queryClient = new QueryClient();
  const defaultFilters = createDefaultDealFilters();
  const serverApiClient = getServerApiClient();
  await queryClient.prefetchQuery(dealsQueryOptions(defaultFilters, serverApiClient));
  await queryClient.prefetchQuery(dealStageMetricsQueryOptions(defaultFilters, serverApiClient));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <DealFunnelHeader />
      <DealFunnelBoard />
      <DealFunnelTable />
    </main>
  );
}

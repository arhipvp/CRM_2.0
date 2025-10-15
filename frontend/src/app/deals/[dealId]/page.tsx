import { notFound } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { DealDetails } from "@/components/deals/DealDetails";
import { getServerApiClient } from "@/lib/api/client";
import { dealDetailsQueryOptions } from "@/lib/api/queries";

type DealPageProps = PageProps<"/deals/[dealId]">;

export const revalidate = 0;

export default async function DealPage({ params }: DealPageProps) {
  const { dealId } = await params;
  const queryClient = new QueryClient();
  const serverApiClient = getServerApiClient();
  const query = dealDetailsQueryOptions(dealId, serverApiClient);
  const result = await queryClient.fetchQuery(query);

  if (!result) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
        <DealDetails dealId={dealId} />
      </main>
    </HydrationBoundary>
  );
}

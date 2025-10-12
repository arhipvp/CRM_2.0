import { notFound } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { DealDetails } from "@/components/deals/DealDetails";
import { dealQueryOptions } from "@/lib/api/queries";

interface DealPageProps {
  params: { dealId: string };
}

export const revalidate = 0;

export default async function DealPage({ params }: DealPageProps) {
  const { dealId } = params;
  const queryClient = new QueryClient();
  const query = dealQueryOptions(dealId);
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

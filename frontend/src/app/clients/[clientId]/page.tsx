import { notFound } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { ClientSummary } from "@/components/clients/ClientSummary";
import { clientQueryOptions } from "@/lib/api/queries";

interface ClientPageProps {
  params: { clientId: string };
}

export const revalidate = 0;

export default async function ClientPage({ params }: ClientPageProps) {
  const { clientId } = params;
  const queryClient = new QueryClient();
  const query = clientQueryOptions(clientId);
  const result = await queryClient.fetchQuery(query);

  if (!result) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <ClientSummary clientId={clientId} />
      </main>
    </HydrationBoundary>
  );
}

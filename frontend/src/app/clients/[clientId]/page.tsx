import { notFound } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { ClientWorkspace } from "@/components/clients/ClientWorkspace";
import {
  clientActivityQueryOptions,
  clientPoliciesQueryOptions,
  clientQueryOptions,
  clientRemindersQueryOptions,
  clientTasksChecklistQueryOptions,
} from "@/lib/api/queries";

interface ClientPageProps {
  params: { clientId: string };
}

export const revalidate = 0;

export default async function ClientPage({ params }: ClientPageProps) {
  const { clientId } = params;
  const queryClient = new QueryClient();
  const clientQuery = clientQueryOptions(clientId);
  const clientResult = await queryClient.fetchQuery(clientQuery);

  if (!clientResult) {
    notFound();
  }

  await Promise.all([
    queryClient.prefetchQuery(clientPoliciesQueryOptions(clientId, { status: "active" })),
    queryClient.prefetchQuery(clientPoliciesQueryOptions(clientId, { status: "archived" })),
    queryClient.prefetchQuery(clientActivityQueryOptions(clientId, { page: 1, pageSize: 5 })),
    queryClient.prefetchQuery(clientTasksChecklistQueryOptions(clientId)),
    queryClient.prefetchQuery(clientRemindersQueryOptions(clientId)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <ClientWorkspace clientId={clientId} />
      </main>
    </HydrationBoundary>
  );
}

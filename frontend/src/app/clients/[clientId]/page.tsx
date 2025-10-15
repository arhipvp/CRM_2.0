import { notFound } from "next/navigation";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { ClientWorkspace } from "@/components/clients/ClientWorkspace";
import { getServerApiClient } from "@/lib/api/client";
import {
  clientActivityQueryOptions,
  clientPoliciesQueryOptions,
  clientQueryOptions,
  clientRemindersQueryOptions,
  clientTasksChecklistQueryOptions,
} from "@/lib/api/queries";

type ClientPageProps = PageProps<"/clients/[clientId]">;

export const revalidate = 0;

export default async function ClientPage({ params }: ClientPageProps) {
  const { clientId } = await params;
  const queryClient = new QueryClient();
  const serverApiClient = getServerApiClient();
  const clientQuery = clientQueryOptions(clientId, serverApiClient);
  const clientResult = await queryClient.fetchQuery(clientQuery);

  if (!clientResult) {
    notFound();
  }

  await Promise.all([
    queryClient.prefetchQuery(
      clientPoliciesQueryOptions(clientId, { status: "active" }, serverApiClient),
    ),
    queryClient.prefetchQuery(
      clientPoliciesQueryOptions(clientId, { status: "archived" }, serverApiClient),
    ),
    queryClient.prefetchQuery(
      clientActivityQueryOptions(clientId, { page: 1, pageSize: 5 }, serverApiClient),
    ),
    queryClient.prefetchQuery(clientTasksChecklistQueryOptions(clientId, serverApiClient)),
    queryClient.prefetchQuery(clientRemindersQueryOptions(clientId, serverApiClient)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <ClientWorkspace clientId={clientId} />
      </main>
    </HydrationBoundary>
  );
}

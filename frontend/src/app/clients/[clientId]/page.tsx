import { notFound } from "next/navigation";
import { QueryClient } from "@tanstack/react-query";
import { ClientWorkspace } from "@/components/clients/ClientWorkspace";
import { clientQueryOptions } from "@/lib/api/queries";

type ClientPageProps = PageProps<"/clients/[clientId]">;

export const revalidate = 0;

export default async function ClientPage({ params }: ClientPageProps) {
  const { clientId } = await params;
  const queryClient = new QueryClient();
  const clientQuery = clientQueryOptions(clientId);
  const clientResult = await queryClient.fetchQuery(clientQuery);

  if (!clientResult) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <ClientWorkspace clientId={clientId} />
    </main>
  );
}

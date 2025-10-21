import { QueryClient } from "@tanstack/react-query";
import { ClientsDirectory } from "@/components/clients/ClientsDirectory";
import { getServerApiClient } from "@/lib/api/client";
import { clientsQueryOptions } from "@/lib/api/queries";

export const revalidate = 0;

export default async function ClientsPage() {
  const queryClient = new QueryClient();
  const serverApiClient = getServerApiClient();
  await queryClient.prefetchQuery(clientsQueryOptions(serverApiClient));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Клиенты</h1>
        <p className="text-slate-500 dark:text-slate-300">
          Управляйте клиентской базой, отслеживайте ответственных менеджеров и историю активности.
        </p>
      </header>
      <ClientsDirectory />
    </main>
  );
}

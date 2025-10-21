import { QueryClient } from "@tanstack/react-query";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { getServerApiClient } from "@/lib/api/client";
import { paymentsQueryOptions } from "@/lib/api/queries";

export const revalidate = 0;

export default async function PaymentsPage() {
  const queryClient = new QueryClient();
  const serverApiClient = getServerApiClient();
  await queryClient.prefetchQuery(paymentsQueryOptions(undefined, serverApiClient));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Платежи</h1>
        <p className="text-slate-500 dark:text-slate-300">
          Отслеживайте статус оплат и быстро переходите к сделкам для уточнений.
        </p>
      </header>
      <PaymentsTable />
    </main>
  );
}

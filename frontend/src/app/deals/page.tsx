import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { DealFunnelBoard } from "@/components/deals/DealFunnelBoard";
import { dealsQueryOptions } from "@/lib/api/queries";

export const revalidate = 0;

export default async function DealsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(dealsQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Воронка сделок</h1>
          <p className="text-slate-500 dark:text-slate-300">
            Управляйте стадиями, следите за конверсией и реагируйте на уведомления в реальном времени.
          </p>
        </header>
        <DealFunnelBoard />
      </main>
    </HydrationBoundary>
  );
}

import { QueryClient } from "@tanstack/react-query";
import { HomeOverview } from "@/components/home/HomeOverview";
import { ApiError, getServerApiClient } from "@/lib/api/client";
import { dealsQueryOptions } from "@/lib/api/queries";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";

export const revalidate = 0;

export default async function HomePage() {
  const queryClient = new QueryClient();
  const defaultFilters = createDefaultDealFilters();
  const serverApiClient = getServerApiClient();

  const prefetchRequests = [
    {
      type: "deals",
      run: () => queryClient.prefetchQuery(dealsQueryOptions(defaultFilters, serverApiClient)),
    },
  ] as const;

  const isApiError = (error: unknown): error is ApiError =>
    error instanceof ApiError ||
    (typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "ApiError");

  await Promise.all(
    prefetchRequests.map(({ type, run }) =>
      run().catch((error) => {
        if (isApiError(error)) {
          console.error(`[SSR] Ошибка предзагрузки запроса ${type}`, error);
          return undefined;
        }

        throw error;
      }),
    ),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Главная</h1>
        <p className="text-slate-500 dark:text-slate-300">
          Быстро оценивайте состояние сделок и переходите к тем, что требуют внимания, не покидая главную страницу.
        </p>
      </header>

      <HomeOverview defaultFilters={defaultFilters} />
    </main>
  );
}

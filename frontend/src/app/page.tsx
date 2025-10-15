import { QueryClient } from "@tanstack/react-query";
import { HomeDealFunnelBoard } from "@/components/deals/HomeDealFunnelBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { getServerApiClient } from "@/lib/api/client";
import { dealsQueryOptions, tasksQueryOptions } from "@/lib/api/queries";
import { createDefaultDealFilters } from "@/lib/utils/dealFilters";
import Link from "next/link";

export const revalidate = 0;

export default async function HomePage() {
  const queryClient = new QueryClient();
  const defaultFilters = createDefaultDealFilters();
  const serverApiClient = getServerApiClient();

  await Promise.all([
    queryClient.prefetchQuery(dealsQueryOptions(defaultFilters, serverApiClient)),
    queryClient.prefetchQuery(tasksQueryOptions(serverApiClient)),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">CRM 2.0</h1>
        <p className="text-slate-500 dark:text-slate-300">
          Контролируйте воронку, платежи и задачи в одном окне. Данные обновляются через SSE и React Query.
        </p>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link href="/deals" className="rounded-full bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-500">
            Воронка сделок
          </Link>
          <Link
            href="/payments"
            className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:border-sky-200 dark:border-slate-700 dark:text-slate-200"
          >
            Платежи
          </Link>
          <Link
            href="/tasks"
            className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:border-sky-200 dark:border-slate-700 dark:text-slate-200"
          >
            Задачи
          </Link>
          <Link
            href="/notifications"
            className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:border-sky-200 dark:border-slate-700 dark:text-slate-200"
          >
            Центр уведомлений
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:border-sky-200 dark:border-slate-700 dark:text-slate-200"
          >
            Администрирование
          </Link>
        </nav>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Текущая воронка</h2>
          <Link href="/deals" className="text-sm font-medium text-sky-600 hover:underline">
            Все сделки
          </Link>
        </div>
        <HomeDealFunnelBoard forceViewMode="kanban" />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Запланированные задачи</h2>
          <Link href="/tasks" className="text-sm font-medium text-sky-600 hover:underline">
            Управлять задачами
          </Link>
        </div>
        <TaskList />
      </section>
    </main>
  );
}

import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { TaskList } from "@/components/tasks/TaskList";
import { getServerApiClient } from "@/lib/api/client";
import { tasksQueryOptions } from "@/lib/api/queries";

export const revalidate = 0;

export default async function TasksPage() {
  const queryClient = new QueryClient();
  const serverApiClient = getServerApiClient();
  await queryClient.prefetchQuery(tasksQueryOptions(serverApiClient));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Задачи</h1>
          <p className="text-slate-500 dark:text-slate-300">
            Используйте чек-лист для ежедневного контроля работы с клиентами и просроченных активностей.
          </p>
        </header>
        <TaskList />
      </main>
    </HydrationBoundary>
  );
}

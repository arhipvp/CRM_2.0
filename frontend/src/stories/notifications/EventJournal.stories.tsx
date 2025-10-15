import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  EventJournal,
  EventJournalEmptyState,
  EventJournalErrorState,
  EventJournalSkeleton,
} from "@/components/notifications/EventJournal";
import { notificationEventJournalMock } from "@/mocks/data";
import { notificationJournalQueryOptions } from "@/lib/api/queries";

const meta: Meta<typeof EventJournal> = {
  title: "Notifications/EventJournal",
  component: EventJournal,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof EventJournal>;

function createStoryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}

export const Default: Story = {
  render: () => {
    const queryClient = createStoryClient();
    queryClient.setQueryData(notificationJournalQueryOptions().queryKey, {
      items: notificationEventJournalMock.slice(0, 3),
      availableCategories: [
        { value: "deal", label: "Сделки" },
        { value: "payment", label: "Платежи" },
      ],
      availableSources: [
        { value: "crm", label: "CRM" },
        { value: "system", label: "Система" },
      ],
    });

    return (
      <QueryClientProvider client={queryClient}>
        <div className="mx-auto max-w-5xl p-6">
          <EventJournal />
        </div>
      </QueryClientProvider>
    );
  },
};

export const Loading: Story = {
  name: "Загрузка",
  render: () => (
    <div className="mx-auto max-w-5xl p-6">
      <EventJournalSkeleton />
    </div>
  ),
};

export const Empty: Story = {
  name: "Пусто",
  render: () => (
    <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <EventJournalEmptyState />
    </div>
  ),
};

export const Error: Story = {
  name: "Ошибка",
  render: () => (
    <div className="mx-auto max-w-5xl p-6">
      <EventJournalErrorState onRetry={() => undefined} />
    </div>
  ),
};

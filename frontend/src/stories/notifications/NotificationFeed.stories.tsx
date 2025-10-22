import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  NotificationFeed,
  NotificationFeedEmptyState,
  NotificationFeedErrorState,
  NotificationFeedSkeleton,
} from "@/components/notifications/NotificationFeed";
import { notificationChannelSettingsMock, notificationFeedMock } from "@/mocks/data";
import { notificationsFeedQueryOptions } from "@/lib/api/queries";

const meta: Meta<typeof NotificationFeed> = {
  title: "Notifications/NotificationFeed",
  component: NotificationFeed,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof NotificationFeed>;

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
    queryClient.setQueryData(notificationsFeedQueryOptions().queryKey, {
      items: notificationFeedMock.slice(0, 3),
      unreadCount: 2,
      availableCategories: [
        { value: "deal", label: "Сделки" },
        { value: "payment", label: "Платежи" },
      ],
      availableSources: [
        { value: "crm", label: "CRM" },
        { value: "system", label: "Система" },
      ],
      channelSettings: notificationChannelSettingsMock,
    });

    return (
      <QueryClientProvider client={queryClient}>
        <div className="mx-auto max-w-4xl p-6">
          <NotificationFeed />
        </div>
      </QueryClientProvider>
    );
  },
};

export const Loading: Story = {
  name: "Загрузка",
  render: () => (
    <div className="mx-auto max-w-4xl p-6">
      <NotificationFeedSkeleton />
    </div>
  ),
};

export const Empty: Story = {
  name: "Пусто",
  render: () => (
    <div className="mx-auto max-w-4xl p-6">
      <NotificationFeedEmptyState onReset={() => undefined} />
    </div>
  ),
};

export const Error: Story = {
  name: "Ошибка",
  render: () => (
    <div className="mx-auto max-w-4xl p-6">
      <NotificationFeedErrorState onRetry={() => undefined} />
    </div>
  ),
};

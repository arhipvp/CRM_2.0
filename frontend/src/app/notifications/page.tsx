import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { NotificationsHeader } from "@/components/notifications/NotificationsHeader";
import { DeliverySettingsPanel } from "@/components/notifications/DeliverySettingsPanel";
import { EventJournal } from "@/components/notifications/EventJournal";
import { getServerApiClient } from "@/lib/api/client";
import {
  notificationJournalQueryOptions,
  notificationsFeedQueryOptions,
} from "@/lib/api/queries";

export const revalidate = 0;

export default async function NotificationsPage() {
  const queryClient = new QueryClient();
  const serverApiClient = getServerApiClient();

  await Promise.all([
    queryClient.prefetchQuery(
      notificationsFeedQueryOptions(
        { status: "all", source: "all", category: "all", search: "" },
        serverApiClient,
      ),
    ),
    queryClient.prefetchQuery(
      notificationJournalQueryOptions(
        { severity: "all", source: "all", category: "all", search: "" },
        serverApiClient,
      ),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <NotificationsHeader />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <NotificationFeed />
          <div className="space-y-6">
            <DeliverySettingsPanel />
            <EventJournal />
          </div>
        </div>
      </main>
    </HydrationBoundary>
  );
}

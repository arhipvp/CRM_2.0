import { NotificationFeed } from "@/components/notifications/NotificationFeed";
import { NotificationsHeader } from "@/components/notifications/NotificationsHeader";
import { DeliverySettingsPanel } from "@/components/notifications/DeliverySettingsPanel";
import { EventJournal } from "@/components/notifications/EventJournal";

export const revalidate = 0;

export default async function NotificationsPage() {
  return (
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
  );
}

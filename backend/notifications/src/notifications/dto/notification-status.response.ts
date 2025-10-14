import { NotificationStatus } from '../notification.entity';

export type NotificationAggregatedStatus = NotificationStatus | 'delivered';

export interface NotificationStatusResponse {
  id: string;
  status: NotificationAggregatedStatus;
  attempts: number;
  channels: string[];
  delivered_at: string | null;
}

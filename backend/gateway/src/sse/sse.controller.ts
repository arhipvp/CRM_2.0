import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';

import { UpstreamSseService } from './upstream-sse.service';

@Controller('v1/streams')
export class SseController {
  constructor(private readonly upstreamSseService: UpstreamSseService) {}

  @Sse('heartbeat')
  heartbeat(): Observable<MessageEvent> {
    return interval(15000).pipe(
      map<number, MessageEvent>((sequence) => ({
        data: {
          type: 'heartbeat',
          sequence
        }
      }))
    );
  }

  private crmDealsStream(): Observable<MessageEvent> {
    return this.upstreamSseService.stream('crm');
  }

  @Sse('deals')
  dealsStream(): Observable<MessageEvent> {
    return this.crmDealsStream();
  }

  @Sse('crm')
  crmStream(): Observable<MessageEvent> {
    return this.crmDealsStream();
  }

  @Sse('payments')
  paymentsStream(): Observable<MessageEvent> {
    return this.upstreamSseService.stream('payments');
  }

  @Sse('notifications')
  notificationsStream(): Observable<MessageEvent> {
    return this.upstreamSseService.stream('notifications');
  }
}

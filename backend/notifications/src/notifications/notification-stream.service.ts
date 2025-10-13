import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationStreamService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationStreamService.name);
  private readonly stream$ = new Subject<MessageEvent>();
  private readonly retryInterval: number;

  constructor(private readonly configService: ConfigService) {
    this.retryInterval = this.configService.get<number>('sse.retryInterval', {
      infer: true
    }) ?? 5000;
  }

  publish(eventType: string, payload: Record<string, unknown>) {
    this.logger.debug(`Broadcasting event ${eventType}`);
    this.stream$.next({
      type: eventType,
      data: {
        eventType,
        payload
      },
      retry: this.retryInterval
    });
  }

  asObservable(): Observable<MessageEvent> {
    return this.stream$.asObservable();
  }

  onModuleDestroy(): void {
    this.stream$.complete();
  }
}

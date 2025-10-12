import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';

@Controller('v1/streams')
export class SseController {
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
}

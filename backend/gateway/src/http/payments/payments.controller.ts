import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { RestProxyService } from '../proxy/rest-proxy.service';

@Controller('v1/payments')
export class PaymentsProxyController {
  constructor(private readonly proxy: RestProxyService) {}

  @All()
  async handleRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxy.forward('payments', '', req, res);
  }

  @All('*')
  async handleWildcard(
    @Param() params: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.proxy.forward('payments', params?.['0'] ?? '', req, res);
  }
}

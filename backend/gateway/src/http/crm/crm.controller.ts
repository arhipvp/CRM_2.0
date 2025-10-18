import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { RestProxyService } from '../proxy/rest-proxy.service';

@Controller('v1/crm')
export class CrmProxyController {
  constructor(private readonly proxy: RestProxyService) {}

  @All()
  async handleRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxy.forward('crm', 'v1', req, res);
  }

  @All('*')
  async handleWildcard(
    @Param() params: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const suffix = params?.['0'] ?? '';
    const normalized = suffix ? `v1/${suffix}` : 'v1';
    await this.proxy.forward('crm', normalized, req, res);
  }
}

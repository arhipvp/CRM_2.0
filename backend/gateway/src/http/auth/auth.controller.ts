import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { RestProxyService } from '../proxy/rest-proxy.service';

@Controller('v1/auth')
export class AuthProxyController {
  constructor(private readonly proxy: RestProxyService) {}

  @All()
  async handleRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxy.forward('auth', '', req, res);
  }

  @All('*')
  async handleWildcard(
    @Param() params: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.proxy.forward('auth', params?.['0'] ?? '', req, res);
  }
}

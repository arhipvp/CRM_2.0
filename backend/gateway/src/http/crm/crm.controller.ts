import { All, Controller, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { RestProxyService } from '../proxy/rest-proxy.service';
import { camelCaseKeysTransformer } from '../proxy/response-transformers';

@Controller('v1/crm')
export class CrmProxyController {
  constructor(private readonly proxy: RestProxyService) {}

  @All()
  async handleRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxy.forward('crm', '', req, res, { transformResponse: camelCaseKeysTransformer });
  }

  @All('*')
  async handleWildcard(
    @Param() params: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.proxy.forward('crm', params?.['0'] ?? '', req, res, { transformResponse: camelCaseKeysTransformer });
  }
}

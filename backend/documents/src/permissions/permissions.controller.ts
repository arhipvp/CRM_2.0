import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { SyncPermissionsDto } from './dto/sync-permissions.dto';
import { SyncPermissionsResponse } from './dto/sync-permissions-response.dto';
import { PermissionsService } from './permissions.service';

@Controller('api/v1/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  sync(@Body() dto: SyncPermissionsDto): Promise<SyncPermissionsResponse> {
    return this.permissionsService.enqueueSync(dto);
  }
}

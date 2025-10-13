import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DriveService } from './drive.service';

@Module({
  imports: [ConfigModule],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}

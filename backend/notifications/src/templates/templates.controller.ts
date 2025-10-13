import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { TemplatesService } from './templates.service';
import { NotificationTemplateEntity } from './notification-template.entity';

@Controller('v1/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async list(@Query() filters: ListTemplatesDto): Promise<NotificationTemplateEntity[]> {
    return this.templatesService.findAll(filters);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTemplateDto): Promise<NotificationTemplateEntity> {
    return this.templatesService.create(dto);
  }
}

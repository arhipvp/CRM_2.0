import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsConfiguration } from '../config/configuration';
import {
  NotificationTemplateChannel,
  NotificationTemplateEntity,
  NotificationTemplateStatus
} from './notification-template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(NotificationTemplateEntity)
    private readonly repository: Repository<NotificationTemplateEntity>,
    private readonly configService: ConfigService<NotificationsConfiguration>
  ) {}

  async findAll(filters: ListTemplatesDto = new ListTemplatesDto()): Promise<NotificationTemplateEntity[]> {
    const qb = this.repository.createQueryBuilder('template');

    if (filters.channel) {
      qb.andWhere('template.channel = :channel', { channel: filters.channel });
    }

    if (filters.active !== undefined) {
      const status = filters.active
        ? NotificationTemplateStatus.ACTIVE
        : NotificationTemplateStatus.INACTIVE;
      qb.andWhere('template.status = :statusFilter', { statusFilter: status });
    }

    qb.orderBy('template.key', 'ASC').addOrderBy('template.locale', 'ASC');

    return qb.getMany();
  }

  async create(dto: CreateTemplateDto): Promise<NotificationTemplateEntity> {
    const existing = await this.repository.findOne({
      where: { key: dto.key, channel: dto.channel }
    });

    if (existing) {
      throw new ConflictException('template_conflict');
    }

    const defaultLocale = this.configService.get<string>('templates.defaultLocale', { infer: true }) ?? 'ru-RU';

    const entity = this.repository.create({
      key: dto.key,
      channel: dto.channel,
      locale: dto.locale ?? defaultLocale,
      body: dto.body,
      metadata: dto.metadata ?? {},
      status: dto.status ?? NotificationTemplateStatus.ACTIVE
    });

    return this.repository.save(entity);
  }
}

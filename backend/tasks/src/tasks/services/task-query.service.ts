import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListTasksDto } from '../dto/list-tasks.dto';
import { TaskEntity } from '../entities/task.entity';

@Injectable()
export class TaskQueryService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>
  ) {}

  async findAll(dto: ListTasksDto): Promise<TaskEntity[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.status', 'status')
      .orderBy('task.dueAt', 'ASC')
      .addOrderBy('task.createdAt', 'ASC');

    if (dto.assigneeId) {
      query.andWhere("task.payload ->> 'assigneeId' = :assigneeId", { assigneeId: dto.assigneeId });
    }

    if (dto.status?.length) {
      query.andWhere('task.statusCode IN (:...status)', { status: dto.status });
    }

    if (dto.dueBefore) {
      query.andWhere('task.dueAt < :dueBefore', { dueBefore: new Date(dto.dueBefore) });
    }

    if (dto.dueAfter) {
      query.andWhere('task.dueAt > :dueAfter', { dueAfter: new Date(dto.dueAfter) });
    }

    if (dto.priority?.length) {
      query.andWhere("task.payload ->> 'priority' IN (:...priority)", { priority: dto.priority });
    }

    const limit = dto.limit ?? 50;
    const offset = dto.offset ?? 0;

    query.take(limit);
    query.skip(offset);

    return query.getMany();
  }

  async findById(id: string): Promise<TaskEntity | null> {
    return this.taskRepository.findOne({ where: { id }, relations: ['status'] });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from '../entities/task.entity';

@Injectable()
export class TaskQueryService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>
  ) {}

  async findById(id: string): Promise<TaskEntity | null> {
    return this.taskRepository.findOne({ where: { id }, relations: ['status'] });
  }
}

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskEntity } from '../entities/task.entity';
import { UpdateTaskCommand } from './update-task.command';
import { TaskUpdateService } from '../services/task-update.service';

@CommandHandler(UpdateTaskCommand)
export class UpdateTaskHandler implements ICommandHandler<UpdateTaskCommand, TaskEntity> {
  constructor(private readonly taskUpdateService: TaskUpdateService) {}

  async execute(command: UpdateTaskCommand): Promise<TaskEntity> {
    return this.taskUpdateService.updateTask(command);
  }
}

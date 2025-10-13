import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './controllers/tasks.controller';
import { TaskEntity } from './entities/task.entity';
import { TaskStatusEntity } from './entities/task-status.entity';
import { TaskReminderEntity } from './entities/task-reminder.entity';
import { CreateTaskHandler } from './commands/create-task.handler';
import { CompleteTaskHandler } from './commands/complete-task.handler';
import { ScheduleTaskHandler } from './commands/schedule-task.handler';
import { TaskEventsPublisher } from './services/task-events.publisher';
import { TaskQueryService } from './services/task-query.service';
import { MessagingModule } from '../messaging/messaging.module';
import { RedisModule } from '../redis/redis.module';
import { DelayedTaskQueueService } from '../delayed/delayed-task-queue.service';
import { DelayedTasksProcessor } from '../delayed/delayed-tasks.processor';
import { WorkerRegistrarService } from '../delayed/worker-registrar.service';
import { ActivateScheduledTaskHandler } from './commands/activate-scheduled-task.handler';
import { UpdateTaskHandler } from './commands/update-task.handler';
import { TaskUpdateService } from './services/task-update.service';
import { CreateTaskReminderHandler } from './commands/create-task-reminder.handler';
import { TaskReminderQueueService } from './services/task-reminder-queue.service';
import { TaskReminderProcessor } from './services/task-reminder-processor.service';

const commandHandlers = [
  CreateTaskHandler,
  CompleteTaskHandler,
  ScheduleTaskHandler,
  ActivateScheduledTaskHandler,
  UpdateTaskHandler,
  CreateTaskReminderHandler
];

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, TaskStatusEntity, TaskReminderEntity]),
    CqrsModule,
    MessagingModule,
    RedisModule
  ],
  controllers: [TasksController],
  providers: [
    ...commandHandlers,
    TaskEventsPublisher,
    TaskQueryService,
    TaskUpdateService,
    TaskReminderQueueService,
    TaskReminderProcessor,
    DelayedTaskQueueService,
    DelayedTasksProcessor,
    WorkerRegistrarService
  ],
  exports: [DelayedTasksProcessor, DelayedTaskQueueService]
})
export class TasksModule {}

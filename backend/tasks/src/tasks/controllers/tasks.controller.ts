import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateTaskDto } from '../dto/create-task.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { CreateTaskCommand } from '../commands/create-task.command';
import { TaskStatusCode } from '../constants/task-status.constants';
import { ScheduleTaskDto } from '../dto/schedule-task.dto';
import { ScheduleTaskCommand } from '../commands/schedule-task.command';
import { CompleteTaskDto } from '../dto/complete-task.dto';
import { CompleteTaskCommand } from '../commands/complete-task.command';
import { ListTasksDto } from '../dto/list-tasks.dto';
import { TaskQueryService } from '../services/task-query.service';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { UpdateTaskCommand } from '../commands/update-task.command';

@Controller('tasks')
export class TasksController {
  constructor(private readonly commandBus: CommandBus, private readonly taskQuery: TaskQueryService) {}

  @Post()
  async create(@Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    const scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : undefined;
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    const status = scheduledFor && scheduledFor.getTime() > Date.now() ? TaskStatusCode.SCHEDULED : TaskStatusCode.PENDING;

    const task = await this.commandBus.execute(
      new CreateTaskCommand(dto.title, dto.description, dueAt, scheduledFor, dto.payload, status)
    );

    return TaskResponseDto.fromEntity(task);
  }

  @Get()
  async list(@Query() dto: ListTasksDto): Promise<TaskResponseDto[]> {
    const tasks = await this.taskQuery.findAll(dto);
    return tasks.map(TaskResponseDto.fromEntity);
  }

  @Get(':id')
  async getById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TaskResponseDto> {
    const task = await this.taskQuery.findById(id);
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return TaskResponseDto.fromEntity(task);
  }

  @Post(':id/schedule')
  async schedule(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ScheduleTaskDto): Promise<TaskResponseDto> {
    const scheduledFor = new Date(dto.scheduledFor);
    const task = await this.commandBus.execute(
      new ScheduleTaskCommand(id, scheduledFor, dto.title, dto.description)
    );
    return TaskResponseDto.fromEntity(task);
  }

  @Post(':id/complete')
  async complete(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: CompleteTaskDto): Promise<TaskResponseDto> {
    const completedAt = dto.completedAt ? new Date(dto.completedAt) : undefined;
    const task = await this.commandBus.execute(new CompleteTaskCommand(id, completedAt));
    return TaskResponseDto.fromEntity(task);
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateTaskDto): Promise<TaskResponseDto> {
    const dueAt = dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null;
    const completedAt =
      dto.completedAt === undefined ? undefined : dto.completedAt ? new Date(dto.completedAt) : null;

    const cancelledReason =
      dto.cancelledReason === undefined ? undefined : dto.cancelledReason ?? null;

    const task = await this.commandBus.execute(
      new UpdateTaskCommand(id, dto.status, dueAt, completedAt, cancelledReason)
    );

    return TaskResponseDto.fromEntity(task);
  }
}

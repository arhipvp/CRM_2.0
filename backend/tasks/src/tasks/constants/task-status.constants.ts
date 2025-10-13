export enum TaskStatusCode {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export const DEFAULT_TASK_STATUSES: Array<{
  code: TaskStatusCode;
  name: string;
  description: string;
  isFinal: boolean;
}> = [
  {
    code: TaskStatusCode.PENDING,
    name: 'Ожидает выполнения',
    description: 'Задача готова к взятию в работу или ожиданию воркера.',
    isFinal: false
  },
  {
    code: TaskStatusCode.SCHEDULED,
    name: 'Отложена',
    description: 'Задача ожидает наступления времени исполнения в Redis-очереди.',
    isFinal: false
  },
  {
    code: TaskStatusCode.IN_PROGRESS,
    name: 'В работе',
    description: 'Задача обрабатывается исполнителем или автоматикой.',
    isFinal: false
  },
  {
    code: TaskStatusCode.COMPLETED,
    name: 'Завершена',
    description: 'Работа по задаче завершена успешно.',
    isFinal: true
  },
  {
    code: TaskStatusCode.CANCELLED,
    name: 'Отменена',
    description: 'Задача отменена и не требует дальнейшей обработки.',
    isFinal: true
  }
];

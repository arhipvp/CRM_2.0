import { HttpException, HttpStatus } from '@nestjs/common';

export class TaskNotFoundException extends HttpException {
  constructor(message = 'Task not found') {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'task_not_found',
        message
      },
      HttpStatus.NOT_FOUND
    );
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

import { DocumentStatus } from './document-status.enum';

export interface DocumentErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class DocumentNotFoundException extends HttpException {
  constructor(id: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'document_not_found',
        message: `Документ ${id} не найден`,
      } satisfies DocumentErrorResponse,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DocumentAlreadyDeletedException extends HttpException {
  constructor(id: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        code: 'already_deleted',
        message: `Документ ${id} уже удалён`,
      } satisfies DocumentErrorResponse,
      HttpStatus.CONFLICT,
    );
  }
}

export class DocumentUploadConflictException extends HttpException {
  constructor(id: string, status: DocumentStatus) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        code: 'upload_conflict',
        message: `Документ ${id} уже находится в статусе ${status}`,
        details: { status },
      } satisfies DocumentErrorResponse,
      HttpStatus.CONFLICT,
    );
  }
}

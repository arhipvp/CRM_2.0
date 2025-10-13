import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';

import { ListDocumentsDto } from './list-documents.dto';

describe('ListDocumentsDto', () => {
  it('преобразует snake_case параметры в camelCase', () => {
    const dto = plainToInstance(ListDocumentsDto, {
      owner_id: '7c24c6f8-3f76-43d4-8596-0fb479c6b6d9',
      owner_type: 'client',
      document_type: ['policy', 'act'],
      search: ' договор ',
    });

    expect(dto.ownerId).toBe('7c24c6f8-3f76-43d4-8596-0fb479c6b6d9');
    expect(dto.ownerType).toBe('client');
    expect(dto.documentType).toEqual(['policy', 'act']);
    expect(dto.search).toBe('договор');
  });

  it('поддерживает строковые значения document_type и фильтрует пустые элементы', () => {
    const dto = plainToInstance(ListDocumentsDto, {
      document_type: 'policy, , act',
    });

    expect(dto.documentType).toEqual(['policy', 'act']);
  });
});

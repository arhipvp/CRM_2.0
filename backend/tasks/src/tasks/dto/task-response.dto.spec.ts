import { TaskEntity } from '../entities/task.entity';
import { TaskResponseDto } from './task-response.dto';
import { TaskStatusEntity } from '../entities/task-status.entity';
import { TaskStatusCode } from '../constants/task-status.constants';

describe('TaskResponseDto', () => {
  const baseStatus = Object.assign(new TaskStatusEntity(), {
    name: 'Pending',
    code: TaskStatusCode.PENDING
  });

  const baseDates = {
    createdAt: new Date('2024-03-01T08:00:00.000Z'),
    updatedAt: new Date('2024-03-01T09:00:00.000Z')
  };

  const buildEntity = (payload: Record<string, unknown> | null) =>
    Object.assign(new TaskEntity(), {
      id: 'task-1',
      title: 'Follow up',
      description: 'Call the client',
      statusCode: TaskStatusCode.PENDING,
      status: baseStatus,
      dueAt: new Date('2024-03-05T10:00:00.000Z'),
      scheduledFor: null,
      completedAt: null,
      cancelledReason: null,
      payload,
      ...baseDates
    });

  it('maps basic fields and extracts structured payload data', () => {
    const entity = buildEntity({
      assigneeId: 'user-123',
      priority: 'high',
      deal_id: 'deal-legacy',
      clientId: 'client-42',
      context: {
        dealId: 'deal-1',
        policy_id: 'policy-2'
      }
    });

    const dto = TaskResponseDto.fromEntity(entity);

    expect(dto).toMatchObject({
      id: 'task-1',
      title: 'Follow up',
      statusCode: TaskStatusCode.PENDING,
      statusName: 'Pending',
      dueAt: '2024-03-05T10:00:00.000Z',
      payload: {
        assigneeId: 'user-123',
        priority: 'high',
        deal_id: 'deal-legacy',
        clientId: 'client-42',
        context: {
          dealId: 'deal-1',
          policy_id: 'policy-2'
        }
      },
      assigneeId: 'user-123',
      priority: 'high',
      dealId: 'deal-legacy',
      clientId: 'client-42',
      context: {
        dealId: 'deal-1',
        policyId: 'policy-2'
      }
    });
  });

  it('falls back to nulls when payload is absent or has no structured fields', () => {
    const entity = buildEntity(null);
    const dto = TaskResponseDto.fromEntity(entity);

    expect(dto.payload).toBeNull();
    expect(dto.assigneeId).toBeNull();
    expect(dto.priority).toBeNull();
    expect(dto.dealId).toBeNull();
    expect(dto.clientId).toBeNull();
    expect(dto.context).toBeNull();
  });

  it('supports camelCase and snake_case for dealId and clientId', () => {
    const entity = buildEntity({
      dealId: 'deal-2',
      client_id: 'client-99'
    });

    const dto = TaskResponseDto.fromEntity(entity);

    expect(dto.dealId).toBe('deal-2');
    expect(dto.clientId).toBe('client-99');
  });
});

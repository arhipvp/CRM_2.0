import { Global, Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { NotificationsModule } from './notifications.module';
import { NotificationsService } from './notifications.service';
import { MessagingModule } from '../messaging/messaging.module';

jest.mock('@golevelup/nestjs-rabbitmq', () => {
  const actual = jest.requireActual('@golevelup/nestjs-rabbitmq');
  const { Module } = jest.requireActual('@nestjs/common');

  class RabbitMQModuleMock {}
  Module({})(RabbitMQModuleMock);

  const forRootAsyncMock = jest.fn(() => ({
    module: RabbitMQModuleMock,
    providers: [
      {
        provide: actual.AmqpConnection,
        useValue: { publish: jest.fn(), request: jest.fn() }
      }
    ],
    exports: [actual.AmqpConnection]
  }));

  Object.defineProperty(RabbitMQModuleMock, 'forRootAsync', {
    value: forRootAsyncMock
  });

  return {
    ...actual,
    RabbitMQModule: RabbitMQModuleMock
  };
});

jest.mock('@nestjs/typeorm', () => {
  const actual = jest.requireActual('@nestjs/typeorm');

  const createRepositoryMock = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn()
  });

  return {
    ...actual,
    TypeOrmModule: {
      forFeature: (entities: unknown[]) => {
        const providers = entities.map((entity) => ({
          provide: actual.getRepositoryToken(entity),
          useValue: createRepositoryMock()
        }));

        @Module({ providers, exports: providers })
        class TypeOrmFeatureTestingModule {}

        return {
          module: TypeOrmFeatureTestingModule,
          providers,
          exports: providers
        };
      }
    },
    getRepositoryToken: actual.getRepositoryToken,
    InjectRepository: actual.InjectRepository
  };
});

const testConfig = () => ({
  rabbitmq: {
    uri: 'amqp://localhost',
    exchange: 'notifications.exchange'
  },
  dispatch: {
    exchange: 'notifications.exchange',
    routingKey: 'notifications.dispatch',
    redisChannel: 'notifications:dispatch',
    retry: {
      maxAttempts: 1,
      delayMs: 0
    }
  },
  sse: {
    retryInterval: 1000
  },
  telegram: {
    enabled: false,
    mock: true,
    botToken: null,
    defaultChatId: null
  }
});

describe('NotificationsModule', () => {
  it('подключает MessagingModule как зависимость', () => {
    const imports =
      (Reflect.getMetadata(MODULE_METADATA.IMPORTS, NotificationsModule) as unknown[]) || [];

    expect(imports).toContain(MessagingModule);
  });

  it('инициализируется без ошибок DI при подмене внешних сервисов', async () => {
    const redisClientMock = { publish: jest.fn() };

    const redisServiceMock = {
      getOrThrow: jest.fn().mockReturnValue(redisClientMock)
    } as unknown as RedisService;

    const amqpConnectionMock = { publish: jest.fn() } as unknown as AmqpConnection;

    @Global()
    @Module({
      providers: [{ provide: RedisService, useValue: redisServiceMock }],
      exports: [RedisService]
    })
    class RedisTestingModule {}

    const testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [testConfig]
        }),
        RedisTestingModule,
        NotificationsModule
      ]
    })
      .overrideProvider(AmqpConnection)
      .useValue(amqpConnectionMock)
      .compile();

    const amqpConnection = testingModule.get(AmqpConnection);
    expect(amqpConnection).toBe(amqpConnectionMock);

    const service = testingModule.get(NotificationsService);
    expect(service).toBeDefined();

    await testingModule.close();
  });
});

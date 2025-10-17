import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const ORIGINAL_ENV = process.env;

describe('ConsulModule', () => {
  const consulConfig = {
    enabled: true,
    scheme: 'http' as const,
    host: 'consul.local',
    port: 8500,
    token: 'token',
    dc: 'dc1',
    timeout: 5000,
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('создает экземпляр клиента Consul при включенной конфигурации', async () => {
    process.env.CONSUL_ENABLED = String(consulConfig.enabled);
    process.env.CONSUL_HTTP_ADDR = `${consulConfig.scheme}://${consulConfig.host}:${consulConfig.port}`;
    process.env.CONSUL_HTTP_TOKEN = consulConfig.token;
    process.env.CONSUL_DC = consulConfig.dc;

    const consulConstructorMock = jest.fn(function (this: { options?: unknown }, options: unknown) {
      this.options = options;
    });

    jest.doMock('consul', () => ({
      default: consulConstructorMock,
      Consul: consulConstructorMock,
    }));

    const { ConsulModule } = await import('./consul.module');
    const { CONSUL_CLIENT } = await import('./consul.constants');

    const moduleRef = await Test.createTestingModule({
      imports: [ConsulModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn().mockReturnValue(consulConfig),
      })
      .compile();

    const client = moduleRef.get<unknown>(CONSUL_CLIENT);

    expect(consulConstructorMock).toHaveBeenCalledTimes(1);
    expect(consulConstructorMock).toHaveBeenCalledWith({
      host: consulConfig.host,
      port: consulConfig.port,
      secure: false,
      defaults: {
        token: consulConfig.token,
        dc: consulConfig.dc,
      },
    });
    expect(client).toBe(consulConstructorMock.mock.instances[0]);

    await moduleRef.close();
  });

  it('использует фабрику, если экспорт consul не является конструктором', async () => {
    process.env.CONSUL_ENABLED = String(consulConfig.enabled);
    process.env.CONSUL_HTTP_ADDR = `${consulConfig.scheme}://${consulConfig.host}:${consulConfig.port}`;
    process.env.CONSUL_HTTP_TOKEN = consulConfig.token;
    process.env.CONSUL_DC = consulConfig.dc;

    const factoryCalls: unknown[] = [];
    const consulFactory = ((options: unknown) => {
      factoryCalls.push(options);

      return { options, createdBy: 'factory' };
    }) as unknown as jest.Mock;

    jest.doMock('consul', () => consulFactory);

    const { ConsulModule } = await import('./consul.module');
    const { CONSUL_CLIENT } = await import('./consul.constants');

    const moduleRef = await Test.createTestingModule({
      imports: [ConsulModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn().mockReturnValue(consulConfig),
      })
      .compile();

    const client = moduleRef.get<{ options: unknown; createdBy: string } | null>(CONSUL_CLIENT);

    expect(factoryCalls).toHaveLength(1);
    expect(factoryCalls[0]).toEqual({
      host: consulConfig.host,
      port: consulConfig.port,
      secure: false,
      defaults: {
        token: consulConfig.token,
        dc: consulConfig.dc,
      },
    });
    expect(client).toEqual({ options: factoryCalls[0], createdBy: 'factory' });

    await moduleRef.close();
  });
});

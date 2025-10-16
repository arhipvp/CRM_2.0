import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { CONSUL_CLIENT } from './consul.constants';
import { ConsulModule } from './consul.module';

jest.mock('consul', () => ({
  default: jest.fn(function (this: { options?: unknown }, options: unknown) {
    this.options = options;
  }),
}));

const { default: consulConstructorMock } = jest.requireMock('consul') as {
  default: jest.Mock;
};

describe('ConsulModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('создает экземпляр клиента Consul при включенной конфигурации', async () => {
    const consulConfig = {
      enabled: true,
      scheme: 'http' as const,
      host: 'consul.local',
      port: 8500,
      token: 'token',
      dc: 'dc1',
      timeout: 5000,
    };

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
});

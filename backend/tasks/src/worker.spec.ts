import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

jest.mock('./app.module', () => ({
  AppModule: class {}
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createApplicationContext: jest.fn()
  }
}));

describe('worker bootstrap logging', () => {
  const mockConfigService = {
    get: jest.fn()
  };
  const mockAppContext = {
    get: jest.fn(),
    enableShutdownHooks: jest.fn()
  };
  const createAppContextMock = NestFactory.createApplicationContext as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    createAppContextMock.mockResolvedValue(mockAppContext);
    mockAppContext.get.mockReturnValue(mockConfigService);
    mockAppContext.enableShutdownHooks.mockReturnValue(undefined);
    mockConfigService.get.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'tasks.scheduling.workerEnabled') {
        return true;
      }
      return defaultValue;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs startup when worker is enabled', async () => {
    const logSpy = jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await import('./worker');
    await new Promise((resolve) => setImmediate(resolve));

    expect(logSpy).toHaveBeenCalledWith(
      'Tasks worker started and polling delayed tasks and reminders queues.',
      'TasksWorker'
    );
    expect(mockAppContext.enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

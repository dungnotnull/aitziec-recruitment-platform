import { HealthController } from '../../src/health/health.controller';
import { HttpStatus } from '@nestjs/common';

describe('HealthController (BE-1-018)', () => {
  let controller: HealthController;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      isHealthy: jest.fn(),
    };
    mockRedis = {
      isHealthy: jest.fn(),
    };
    controller = new HealthController(mockPrisma, mockRedis);
  });

  it('/health/live returns 200 ok without checking dependencies', () => {
    const res = controller.checkLiveness();
    expect(res).toEqual({ status: 'ok' });
    expect(mockPrisma.isHealthy).not.toHaveBeenCalled();
    expect(mockRedis.isHealthy).not.toHaveBeenCalled();
  });

  it('/health/ready returns 200 when all dependencies are healthy', async () => {
    mockPrisma.isHealthy.mockResolvedValue(true);
    mockRedis.isHealthy.mockResolvedValue(true);

    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const resMock: any = { status: statusMock };

    await controller.checkReadiness(resMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 'ready',
      checks: {
        database: 'up',
        redis: 'up',
      },
    });
  });

  it('/health/ready returns 503 when a dependency fails without disclosing hostnames or secrets', async () => {
    mockPrisma.isHealthy.mockResolvedValue(false);
    mockRedis.isHealthy.mockResolvedValue(true);

    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const resMock: any = { status: statusMock };

    await controller.checkReadiness(resMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 'unavailable',
      checks: {
        database: 'down',
        redis: 'up',
      },
    });
  });

  it('/health/ready returns 503 when encryption configuration is missing or invalid', async () => {
    mockPrisma.isHealthy.mockResolvedValue(true);
    mockRedis.isHealthy.mockResolvedValue(true);
    const mockSecretAdapter = { isConfigured: jest.fn().mockReturnValue(false) };
    const healthController = new HealthController(mockPrisma, mockRedis, mockSecretAdapter as any);

    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const resMock: any = { status: statusMock };

    await healthController.checkReadiness(resMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonMock).toHaveBeenCalledWith({
      status: 'unavailable',
      checks: {
        database: 'up',
        redis: 'up',
        encryption: 'down',
      },
    });
  });
});

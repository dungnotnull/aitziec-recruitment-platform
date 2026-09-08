import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Process liveness check' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  checkLiveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Dependency readiness check' })
  @ApiResponse({ status: 200, description: 'Dependencies are ready' })
  @ApiResponse({ status: 503, description: 'Dependencies are not ready' })
  async checkReadiness(@Res() res: Response) {
    const [dbHealthy, redisHealthy] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);

    const isReady = dbHealthy && redisHealthy;
    const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isReady ? 'ready' : 'unavailable',
      checks: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
    });
  }
}

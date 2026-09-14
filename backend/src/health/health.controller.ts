import { Controller, Get, HttpStatus, Optional, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../common/decorators/public.decorator';
import { InvitationSecretAdapter } from '../companies/adapters/invitation-secret.adapter';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Optional() private readonly secretAdapter?: InvitationSecretAdapter,
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

    const encryptionHealthy = this.secretAdapter ? this.secretAdapter.isConfigured() : true;

    const isReady = dbHealthy && redisHealthy && encryptionHealthy;
    const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    const checks: Record<string, string> = {
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
    };

    if (this.secretAdapter) {
      checks.encryption = encryptionHealthy ? 'up' : 'down';
    }

    return res.status(statusCode).json({
      status: isReady ? 'ready' : 'unavailable',
      checks,
    });
  }
}

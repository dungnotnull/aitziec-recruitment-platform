import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('Observability')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus metrics endpoint (BE-7-007, BE-7-008)' })
  @ApiResponse({ status: 200, description: 'Prometheus formatted metrics text' })
  async getMetrics(): Promise<string> {
    return this.metricsService.getPrometheusMetrics();
  }
}

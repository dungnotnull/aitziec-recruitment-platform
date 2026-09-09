import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { RecommendationQueryDto } from './dto/recommendation.dto';
import { CollectionResponse } from '../common/dto/response.dto';
import { JobDto } from '../jobs/dto/job.dto';

@ApiTags('Recommendations')
@Controller('recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecommendationsController {
  constructor(private readonly aiService: AiService) {}

  @Get('jobs')
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get explainable job recommendations tailored for authenticated candidate (BE-6-017)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated recommended jobs',
  })
  async getRecommendedJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecommendationQueryDto,
  ): Promise<CollectionResponse<JobDto>> {
    return this.aiService.getJobRecommendations(user, query);
  }
}

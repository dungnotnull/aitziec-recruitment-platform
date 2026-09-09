import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SavedJobsService } from './saved-jobs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto, CollectionResponse } from '../common/dto/response.dto';
import { JobDto } from '../jobs/dto/job.dto';

@ApiTags('Saved Jobs')
@Controller('saved-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CANDIDATE')
@ApiBearerAuth()
export class SavedJobsController {
  constructor(private readonly savedJobsService: SavedJobsService) {}

  @Get()
  @ApiOperation({ summary: "List candidate's own saved jobs with cursor pagination" })
  @ApiResponse({ status: 200, description: 'Saved jobs list' })
  async listSavedJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<CollectionResponse<JobDto>> {
    return this.savedJobsService.listSavedJobs(user, query);
  }

  @Put(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Idempotently save a job bookmark' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 204, description: 'Job saved successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async saveJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.savedJobsService.saveJob(jobId, user);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Idempotently unsave a job bookmark' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 204, description: 'Job unsaved successfully' })
  async unsaveJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.savedJobsService.unsaveJob(jobId, user);
  }
}

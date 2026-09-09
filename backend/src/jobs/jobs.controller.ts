import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  CloseJobDto,
  CreateJobDto,
  JobDto,
  ModerateJobDto,
  PublishJobDto,
  UnpublishJobDto,
  UpdateJobDto,
} from './dto/job.dto';

@ApiTags('Jobs')
@Controller()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('companies/:companyId/jobs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a draft job for an authorized company' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 201, description: 'Job created successfully as DRAFT', type: JobDto })
  async createDraftJob(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJobDto,
  ): Promise<JobDto> {
    return this.jobsService.createDraftJob(companyId, user, dto);
  }

  @Get('jobs/:jobIdOrSlug')
  @Public()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Read job detail (public for open published jobs; scoped HR/Admin for non-public)',
  })
  @ApiParam({ name: 'jobIdOrSlug', description: 'Job UUID or slug' })
  @ApiResponse({ status: 200, description: 'Job details', type: JobDto })
  @ApiResponse({ status: 404, description: 'Job not found or inaccessible' })
  async getJobDetail(
    @Param('jobIdOrSlug') jobIdOrSlug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<JobDto> {
    return this.jobsService.getJobDetail(jobIdOrSlug, user);
  }

  @Patch('jobs/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update job details with optimistic concurrency check' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job updated successfully', type: JobDto })
  @ApiResponse({ status: 409, description: 'Version conflict or job is closed' })
  async updateJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateJobDto,
  ): Promise<JobDto> {
    return this.jobsService.updateJob(jobId, user, dto);
  }

  @Post('jobs/:jobId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a draft or unpublished job' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job published successfully', type: JobDto })
  @ApiResponse({ status: 400, description: 'Job not publishable' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async publishJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PublishJobDto,
  ): Promise<JobDto> {
    return this.jobsService.publishJob(jobId, user, dto);
  }

  @Post('jobs/:jobId/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish a published job' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job unpublished successfully', type: JobDto })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async unpublishJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnpublishJobDto,
  ): Promise<JobDto> {
    return this.jobsService.unpublishJob(jobId, user, dto);
  }

  @Post('jobs/:jobId/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close an open or unpublished job' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job closed successfully', type: JobDto })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async closeJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloseJobDto,
  ): Promise<JobDto> {
    return this.jobsService.closeJob(jobId, user, dto);
  }

  @Post('admin/jobs/:jobId/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin moderation: unpublish or close a job' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'Job moderated successfully', type: JobDto })
  async moderateJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModerateJobDto,
  ): Promise<JobDto> {
    return this.jobsService.moderateJob(jobId, user, dto);
  }
}

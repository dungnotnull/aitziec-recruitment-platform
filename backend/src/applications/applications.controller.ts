import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import {
  ApplicationDetailDto,
  ApplicationDto,
  ApplicationQueryDto,
  SubmitApplicationDto,
  TransitionApplicationDto,
} from './dto/application.dto';

@ApiTags('Applications')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post('jobs/:jobId/applications')
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit an application for a published job' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  async submitApplication(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitApplicationDto,
    @Req() req: Request,
  ): Promise<ApplicationDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.applicationsService.submitApplication(user, jobId, dto, requestId);
  }

  @Get('applications')
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List current candidate applications' })
  async getCandidateApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ApplicationQueryDto,
  ): Promise<{ data: ApplicationDetailDto[]; meta: any }> {
    return this.applicationsService.getCandidateApplications(user, query);
  }

  @Get('applications/:applicationId')
  @Roles('CANDIDATE', 'HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get application detail by ID' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  async getApplicationDetail(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationDetailDto> {
    return this.applicationsService.getApplicationDetail(user, applicationId);
  }

  @Get('jobs/:jobId/applications')
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List applications for a job (scoped HR or admin)' })
  @ApiParam({ name: 'jobId', description: 'Job UUID' })
  async getJobApplications(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ApplicationQueryDto,
  ): Promise<{ data: ApplicationDetailDto[]; meta: any }> {
    return this.applicationsService.getJobApplications(user, jobId, query);
  }

  @Post('applications/:applicationId/transitions')
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition application status (scoped HR or admin)' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  async transitionApplication(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransitionApplicationDto,
    @Req() req: Request,
  ): Promise<ApplicationDetailDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.applicationsService.transitionApplication(user, applicationId, dto, requestId);
  }
}

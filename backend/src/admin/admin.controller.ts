import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AdminService } from './admin.service';
import { AdminUserQueryDto, UpdateUserStatusDto } from './dto/admin-user.dto';
import { UpdateCompanyStatusDto } from './dto/admin-company.dto';
import { ModerateJobDto } from './dto/admin-job.dto';
import { AuditLogDto, AuditLogQueryDto } from './dto/admin-audit.dto';
import { CollectionResponse } from '../common/dto/response.dto';
import { UserSummaryDto } from '../auth/dto/auth.dto';
import { CompanyDto } from '../companies/dto/company.dto';
import { JobDto } from '../jobs/dto/job.dto';
import { AdminCompanyQueryDto } from './dto/admin-company-query.dto';
import { AdminJobQueryDto } from './dto/admin-job-query.dto';
import {
  AdminApplicationDetailDto,
  AdminApplicationQueryDto,
  AdminApplicationSummaryDto,
  ModerateApplicationDto,
} from './dto/admin-application.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Admin user list with filters and cursor pagination (BE-7-001)' })
  @ApiResponse({ status: 200, description: 'Paginated user summaries' })
  async listUsers(@Query() query: AdminUserQueryDto): Promise<CollectionResponse<UserSummaryDto>> {
    return this.adminService.listUsers(query);
  }

  @Get('companies')
  @ApiOperation({
    summary: 'Admin list companies with search, status filter and cursor pagination (BE-8-013)',
  })
  @ApiResponse({ status: 200, description: 'Paginated company collection' })
  async listCompanies(
    @Query() query: AdminCompanyQueryDto,
    @Req() req: Request,
  ): Promise<CollectionResponse<CompanyDto>> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.adminService.listCompanies(query, requestId);
  }

  @Get('jobs')
  @ApiOperation({
    summary:
      'Admin list jobs across companies with search, status, experience filter and cursor pagination (BE-8-013)',
  })
  @ApiResponse({ status: 200, description: 'Paginated job collection' })
  async listJobs(
    @Query() query: AdminJobQueryDto,
    @Req() req: Request,
  ): Promise<CollectionResponse<JobDto>> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.adminService.listJobs(query, requestId);
  }

  @Patch('users/:userId/status')
  @ApiOperation({
    summary: 'Audited user status moderation with automatic session revocation (BE-7-002)',
  })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User status moderated successfully' })
  async moderateUserStatus(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ): Promise<UserSummaryDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.adminService.moderateUserStatus(adminUser, userId, dto, requestId);
  }

  @Patch('companies/:companyId/status')
  @ApiOperation({
    summary: 'Audited company status moderation with optimistic concurrency (BE-7-003)',
  })
  @ApiParam({ name: 'companyId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Company status updated successfully' })
  async moderateCompanyStatus(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyStatusDto,
    @Req() req: Request,
  ): Promise<CompanyDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.adminService.moderateCompanyStatus(adminUser, companyId, dto, requestId);
  }

  @Post('jobs/:jobId/moderate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Audited job moderation (unpublish or close) with optimistic concurrency (BE-7-004)',
  })
  @ApiParam({ name: 'jobId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job moderated successfully' })
  async moderateJob(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: ModerateJobDto,
    @Req() req: Request,
  ): Promise<JobDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.adminService.moderateJob(adminUser, jobId, dto, requestId);
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Authorized append-only audit log query endpoint with redaction (BE-7-006)',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit logs' })
  async queryAuditLogs(@Query() query: AuditLogQueryDto): Promise<CollectionResponse<AuditLogDto>> {
    return this.adminService.queryAuditLogs(query);
  }

  @Get('applications')
  @ApiOperation({
    summary:
      'Admin list applications with search, status, company, job, and date range filters (BE-8-014)',
  })
  @ApiResponse({ status: 200, description: 'Paginated application collection' })
  async listApplications(
    @Query() query: AdminApplicationQueryDto,
    @Req() req: Request,
  ): Promise<CollectionResponse<AdminApplicationSummaryDto>> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.adminService.listApplications(query, requestId);
  }

  @Get('applications/:applicationId')
  @ApiOperation({
    summary: 'Admin get application detail with ordered status history (BE-8-014)',
  })
  @ApiParam({ name: 'applicationId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Redacted application detail' })
  async getApplicationDetail(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<AdminApplicationDetailDto> {
    return this.adminService.getApplicationDetail(applicationId);
  }

  @Post('applications/:applicationId/moderate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Audited admin application moderation with optimistic concurrency and shared state transition policy (BE-8-015)',
  })
  @ApiParam({ name: 'applicationId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Application moderated successfully' })
  async moderateApplication(
    @CurrentUser() adminUser: AuthenticatedUser,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: ModerateApplicationDto,
    @Req() req: Request,
  ): Promise<AdminApplicationDetailDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.adminService.moderateApplication(adminUser, applicationId, dto, requestId);
  }
}

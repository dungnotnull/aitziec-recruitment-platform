import {
  Body,
  Controller,
  Get,
  Headers,
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { InterviewsService } from './interviews.service';
import {
  CancelInterviewDto,
  CompleteInterviewDto,
  CreateInterviewDto,
  InterviewDto,
  InterviewQueryDto,
  UpdateInterviewDto,
} from './dto/interview.dto';

@ApiTags('Interviews')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post('applications/:applicationId/interviews')
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule an interview for an application in INTERVIEWING status' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional idempotency key (16-128 printable ASCII characters)',
  })
  @ApiResponse({ status: 201, description: 'Interview scheduled successfully' })
  async scheduleInterview(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInterviewDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<InterviewDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.interviewsService.scheduleInterview(
      user,
      applicationId,
      dto,
      requestId,
      idempotencyKey,
    );
  }

  @Get('applications/:applicationId/interviews')
  @Roles('CANDIDATE', 'HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List interviews for an application with role-based visibility' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  @ApiResponse({ status: 200, description: 'List of interviews' })
  async listApplicationInterviews(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InterviewQueryDto,
  ): Promise<{
    data: InterviewDto[];
    meta: { hasMore: boolean; nextCursor: string | null; total: number };
  }> {
    return this.interviewsService.listApplicationInterviews(user, applicationId, query);
  }

  @Get('interviews/:interviewId')
  @Roles('CANDIDATE', 'HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read interview detail with role-specific projections' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview detail' })
  async getInterviewDetail(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InterviewDto> {
    return this.interviewsService.getInterviewDetail(user, interviewId);
  }

  @Patch('interviews/:interviewId')
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reschedule or update interview instructions, notes, or feedback' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview updated successfully' })
  async updateInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateInterviewDto,
    @Req() req: Request,
  ): Promise<InterviewDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.interviewsService.updateInterview(user, interviewId, dto, requestId);
  }

  @Post('interviews/:interviewId/complete')
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark interview completed with optional recruiter feedback' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview completed' })
  async completeInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteInterviewDto,
    @Req() req: Request,
  ): Promise<InterviewDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.interviewsService.completeInterview(user, interviewId, dto, requestId);
  }

  @Post('interviews/:interviewId/cancel')
  @Roles('HR', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel interview with a required reason' })
  @ApiParam({ name: 'interviewId', description: 'Interview UUID' })
  @ApiResponse({ status: 200, description: 'Interview cancelled' })
  async cancelInterview(
    @Param('interviewId', ParseUUIDPipe) interviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelInterviewDto,
    @Req() req: Request,
  ): Promise<InterviewDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.interviewsService.cancelInterview(user, interviewId, dto, requestId);
  }
}

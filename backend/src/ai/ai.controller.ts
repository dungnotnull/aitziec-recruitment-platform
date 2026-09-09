import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { AiService } from './ai.service';
import { CreateCvJobAnalysisDto } from './dto/create-analysis.dto';
import { AiAnalysisDto } from './dto/ai-analysis.dto';
import { OperationDto } from './dto/operation.dto';

@ApiTags('AI Analysis')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('cv-job-analyses')
  @Roles('CANDIDATE', 'HR', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request asynchronous AI analysis between a CV and a Job (BE-6-011)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional idempotency key (16-128 chars)',
  })
  @ApiResponse({
    status: 202,
    description: 'Analysis request accepted and queued',
    type: OperationDto,
  })
  @ApiResponse({ status: 409, description: 'CV_NOT_READY: Text extraction not complete' })
  async createCvJobAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCvJobAnalysisDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<OperationDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.aiService.createCvJobAnalysis(user, dto, requestId, idempotencyKey);
  }

  @Get('analyses/:analysisId')
  @Roles('CANDIDATE', 'HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve structured AI Analysis detail by UUID (BE-6-011)' })
  @ApiParam({ name: 'analysisId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'AI Analysis retrieved successfully',
    type: AiAnalysisDto,
  })
  async getAnalysis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('analysisId', ParseUUIDPipe) analysisId: string,
  ): Promise<AiAnalysisDto> {
    return this.aiService.getAnalysisDetail(user, analysisId);
  }
}

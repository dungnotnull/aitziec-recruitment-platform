import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CvsService } from './cvs.service';
import {
  CvDto,
  CvQueryDto,
  OperationDto,
  SetDefaultCvDto,
  SignedDownloadDto,
  UploadedCvFile,
} from './dto/cv.dto';

@ApiTags('CVs')
@Controller('cvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CvsController {
  constructor(private readonly cvsService: CvsService) {}

  @Post()
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a candidate CV PDF (max 10 MiB)' })
  @ApiResponse({ status: 202, description: 'CV uploaded and extraction queued' })
  async uploadCv(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedCvFile,
    @Req() req: Request,
  ): Promise<{ cv: CvDto; operation: OperationDto }> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.cvsService.uploadCv(user, file, requestId);
  }

  @Get()
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List candidate CVs' })
  async listCandidateCvs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CvQueryDto,
  ): Promise<{ data: CvDto[]; meta: any }> {
    return this.cvsService.listCandidateCvs(user, query);
  }

  @Get(':cvId')
  @Roles('CANDIDATE', 'HR', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get CV metadata by ID' })
  @ApiParam({ name: 'cvId', description: 'CV UUID' })
  async getCvDetail(
    @Param('cvId', ParseUUIDPipe) cvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CvDto> {
    return this.cvsService.getCvDetail(user, cvId);
  }

  @Post(':cvId/default')
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a CV as default' })
  @ApiParam({ name: 'cvId', description: 'CV UUID' })
  async setDefaultCv(
    @Param('cvId', ParseUUIDPipe) cvId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetDefaultCvDto,
    @Req() req: Request,
  ): Promise<CvDto> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    return this.cvsService.setDefaultCv(user, cvId, dto.expectedVersion, requestId);
  }

  @Post(':cvId/download-url')
  @Roles('CANDIDATE', 'HR', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get presigned download URL for CV PDF' })
  @ApiParam({ name: 'cvId', description: 'CV UUID' })
  async getSignedDownloadUrl(
    @Param('cvId', ParseUUIDPipe) cvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SignedDownloadDto> {
    return this.cvsService.getSignedDownloadUrl(user, cvId);
  }

  @Delete(':cvId')
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete or soft-delete a candidate CV' })
  @ApiParam({ name: 'cvId', description: 'CV UUID' })
  async deleteCv(
    @Param('cvId', ParseUUIDPipe) cvId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    await this.cvsService.deleteCv(user, cvId, requestId);
  }
}

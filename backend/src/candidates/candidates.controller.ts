import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CandidatesService, UploadedAvatarFile } from './candidates.service';
import {
  CandidateProfileDto,
  UpdateCandidateProfileDto,
  UploadCandidateAvatarDto,
  UploadCandidateAvatarResponseDto,
} from './dto/candidate.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Candidate Profile')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Roles('CANDIDATE')
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current authenticated candidate profile' })
  @ApiResponse({ status: 200, type: CandidateProfileDto, description: 'Candidate profile' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden for non-candidate' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getMyProfile(@CurrentUser('id') userId: string): Promise<CandidateProfileDto> {
    return this.candidatesService.getProfile(userId);
  }

  @Roles('CANDIDATE')
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update profile, skills, and experience with optimistic concurrency' })
  @ApiResponse({ status: 200, type: CandidateProfileDto, description: 'Updated candidate profile' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCandidateProfileDto,
  ): Promise<CandidateProfileDto> {
    return this.candidatesService.updateProfile(userId, dto);
  }

  @Roles('CANDIDATE')
  @Post('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload and update candidate profile avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file (PNG, JPEG, WebP, max 5 MiB)',
        },
        expectedVersion: {
          type: 'integer',
          example: 1,
          description: 'Optional expected version for optimistic concurrency',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: UploadCandidateAvatarResponseDto,
    description: 'Avatar updated successfully',
  })
  @ApiResponse({ status: 400, description: 'File missing or invalid' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden for non-candidate' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  @ApiResponse({ status: 413, description: 'File exceeds 5 MiB' })
  @ApiResponse({ status: 415, description: 'Invalid image signature or MIME' })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: UploadedAvatarFile,
    @Body() body?: UploadCandidateAvatarDto,
  ): Promise<UploadCandidateAvatarResponseDto> {
    return this.candidatesService.uploadAvatar(userId, file, {
      expectedVersion:
        body?.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined,
    });
  }
}

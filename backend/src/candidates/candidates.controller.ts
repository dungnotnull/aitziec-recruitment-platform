import { Controller, Get, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CandidatesService } from './candidates.service';
import { CandidateProfileDto, UpdateCandidateProfileDto } from './dto/candidate.dto';
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
}

import { Body, Controller, Get, Headers, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import {
  RecommendationPreferenceDto,
  UpdateRecommendationPreferenceDto,
} from './dto/recommendation-preference.dto';

@ApiTags('Recommendation Preferences')
@Controller('recommendation-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecommendationPreferencesController {
  constructor(private readonly aiService: AiService) {}

  @Get()
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recommendation preferences and consent status (BE-8-021)',
  })
  @ApiResponse({
    status: 200,
    description: 'Current candidate recommendation preferences',
    type: RecommendationPreferenceDto,
  })
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RecommendationPreferenceDto> {
    return this.aiService.getRecommendationPreferences(user);
  }

  @Patch()
  @Roles('CANDIDATE')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update recommendation preferences and consent status (BE-8-021)',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated recommendation preferences',
    type: RecommendationPreferenceDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Version conflict',
  })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRecommendationPreferenceDto,
    @Headers('x-request-id') requestId?: string,
  ): Promise<RecommendationPreferenceDto> {
    return this.aiService.updateRecommendationPreferences(user, dto, requestId);
  }
}

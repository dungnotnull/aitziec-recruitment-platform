import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { HrProfileDto, UpdateHrProfileDto } from './dto/hr-profile.dto';
import { HrInvitationItemDto } from './dto/hr-invitation.dto';
import { PaginationQueryDto, CollectionResponse } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('HR Profile & Invitations')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Roles('HR')
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current authenticated HR personal profile' })
  @ApiResponse({ status: 200, type: HrProfileDto, description: 'HR personal profile' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden for non-HR role' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser): Promise<HrProfileDto> {
    return this.hrService.getProfile(user.id);
  }

  @Roles('HR')
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update HR personal profile with optimistic concurrency' })
  @ApiResponse({ status: 200, type: HrProfileDto, description: 'Updated HR personal profile' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden for non-HR role' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHrProfileDto,
  ): Promise<HrProfileDto> {
    return this.hrService.updateProfile(user.id, dto);
  }

  @Roles('HR')
  @Get('invitations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List pending company invitations for current authenticated HR' })
  @ApiResponse({
    status: 200,
    type: CollectionResponse,
    description: 'Collection of pending company invitations',
  })
  @ApiResponse({ status: 400, description: 'Invalid cursor' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden for non-HR role' })
  async listMyInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<CollectionResponse<HrInvitationItemDto>> {
    return this.hrService.listInvitations(user, query);
  }
}

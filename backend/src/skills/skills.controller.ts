import { Controller, Get, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { SkillCatalogQueryDto, SkillCatalogItemDto } from './dto/skill-catalog.dto';
import { CollectionResponse } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Skills')
@Controller('skills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CANDIDATE', 'HR', 'ADMIN')
@ApiBearerAuth()
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List and search skill catalog with cursor pagination' })
  @ApiResponse({ status: 200, description: 'Skill catalog collection' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid cursor' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listSkills(
    @Query() query: SkillCatalogQueryDto,
    @Headers('x-request-id') requestId?: string,
  ): Promise<CollectionResponse<SkillCatalogItemDto>> {
    return this.skillsService.listSkills(query, requestId);
  }
}

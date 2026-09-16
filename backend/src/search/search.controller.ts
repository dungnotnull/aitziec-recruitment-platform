import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JobSearchQueryDto, ParseSearchQueryDto } from './dto/search.dto';
import { Public } from '../common/decorators/public.decorator';
import { JobDto } from '../jobs/dto/job.dto';
import { CollectionResponse } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Search')
@Controller('jobs')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Public()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Public job browse and search with full-text queries, filters, and cursor pagination',
  })
  @ApiResponse({ status: 200, description: 'List of matching jobs' })
  async searchJobs(
    @Query() query: JobSearchQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<CollectionResponse<JobDto>> {
    return this.searchService.searchJobs(query, user);
  }

  @Post('search/parse')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Parse natural-language query into structured job search filters',
  })
  @ApiResponse({ status: 200, description: 'Parsed structured filters' })
  async parseSearchQuery(@Body() dto: ParseSearchQueryDto): Promise<Record<string, unknown>> {
    return this.searchService.parseSearchQuery(dto);
  }
}

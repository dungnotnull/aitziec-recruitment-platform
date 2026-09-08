import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import {
  CompanyDto,
  CreateCompanyDto,
  UpdateCompanyDto,
  AddCompanyMemberDto,
  CompanyMembershipDto,
} from './dto/company.dto';
import { PaginationQueryDto } from '../common/dto/response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HR', 'ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company with caller as owner' })
  @ApiResponse({ status: 201, type: CompanyDto, description: 'Company created' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  async createCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
  ): Promise<CompanyDto> {
    return this.companiesService.createCompany(user, dto);
  }

  @Public()
  @Get(':companyIdOrSlug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get public company profile by ID or slug' })
  @ApiResponse({ status: 200, type: CompanyDto, description: 'Company details' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompany(@Param('companyIdOrSlug') idOrSlug: string): Promise<CompanyDto> {
    return this.companiesService.getCompanyByIdOrSlug(idOrSlug);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Patch(':companyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update company details with optimistic concurrency' })
  @ApiResponse({ status: 200, type: CompanyDto, description: 'Company updated' })
  @ApiResponse({ status: 403, description: 'Not authorized for this company' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async updateCompany(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyDto> {
    return this.companiesService.updateCompany(companyId, user, dto);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Get(':companyId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List company memberships with cursor pagination' })
  @ApiResponse({ status: 200, description: 'Collection of members' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  async listMembers(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.companiesService.listMembers(companyId, user, query);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Post(':companyId/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a recruiter to company by email' })
  @ApiResponse({ status: 201, type: CompanyMembershipDto, description: 'Member added' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User already a member' })
  async addMember(
    @Param('companyId') companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCompanyMemberDto,
  ): Promise<CompanyMembershipDto> {
    return this.companiesService.addMember(companyId, user, dto);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Delete(':companyId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a company member' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 409, description: 'Cannot remove last owner' })
  async removeMember(
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.companiesService.removeMember(companyId, memberId, user);
  }
}

import { Controller, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CompanyMembershipDto } from './dto/company.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Company Invitations')
@Controller('company-invitations')
export class CompanyInvitationsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Post(':token/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept a company invitation using a secure one-time token' })
  @ApiResponse({
    status: 201,
    type: CompanyMembershipDto,
    description: 'Invitation accepted and membership created',
  })
  @ApiResponse({ status: 403, description: 'Email mismatch' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({
    status: 409,
    description: 'Invitation expired, revoked, already accepted, or user already a member',
  })
  async acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompanyMembershipDto> {
    return this.companiesService.acceptInvitation(token, user);
  }
}

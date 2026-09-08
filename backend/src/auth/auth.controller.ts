import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, AuthSessionDto, UserSummaryDto } from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthRateLimitGuard } from '../common/guards/auth-rate-limit.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new candidate or HR account' })
  @ApiResponse({ status: 201, type: AuthSessionDto, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    return this.authService.register(dto, res);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate credentials and create session' })
  @ApiResponse({ status: 200, type: AuthSessionDto, description: 'Logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account suspended or disabled' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    return this.authService.login(dto, res);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('itziec_refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiResponse({ status: 200, type: AuthSessionDto, description: 'Session refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or reused refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const rawToken = req.cookies?.['itziec_refresh'];
    return this.authService.refresh(rawToken, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('itziec_refresh')
  @ApiOperation({ summary: 'Revoke current refresh session' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawToken = req.cookies?.['itziec_refresh'];
    return this.authService.logout(rawToken, res);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Revoke all refresh sessions for current user' })
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.authService.logoutAll(userId, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, type: UserSummaryDto, description: 'Current user profile' })
  async me(@CurrentUser('id') userId: string): Promise<UserSummaryDto> {
    return this.authService.me(userId);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  MarkNotificationReadDto,
  NotificationDto,
  NotificationQueryDto,
} from './dto/notification.dto';
import { CollectionResponse } from '../common/dto/response.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List notifications for current user with read filtering and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    type: NotificationDto,
    isArray: true,
  })
  async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationQueryDto,
  ): Promise<CollectionResponse<NotificationDto>> {
    return this.notificationsService.listNotifications(user, query);
  }

  @Patch(':notificationId/read')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read or unread' })
  @ApiParam({ name: 'notificationId', description: 'Notification UUID' })
  @ApiResponse({
    status: 200,
    description: 'Notification updated read state',
    type: NotificationDto,
  })
  async markAsRead(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
    @Body() body: MarkNotificationReadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationDto> {
    return this.notificationsService.markAsRead(user, notificationId, body);
  }
}

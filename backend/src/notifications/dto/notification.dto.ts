import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { NotificationType } from '@prisma/client';

export class NotificationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by read state (true for read, false for unread)',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  read?: boolean;

  @ApiPropertyOptional({
    description: 'Opaque pagination cursor',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of notifications per page',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class NotificationResourceDto {
  @ApiProperty({ description: 'Referenced resource type', example: 'APPLICATION' })
  type: string;

  @ApiProperty({
    description: 'Referenced resource ID',
    example: 'd3b07384-d113-4660-84cf-29e612a440d4',
  })
  id: string;
}

export class NotificationDto {
  @ApiProperty({
    description: 'Notification ID',
    example: 'd3b07384-d113-4660-84cf-29e612a440d4',
  })
  id: string;

  @ApiProperty({ enum: NotificationType, description: 'Notification type' })
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiProperty({ description: 'Notification body text' })
  body: string;

  @ApiProperty({
    description: 'Referenced resource type and ID',
    type: NotificationResourceDto,
    nullable: true,
  })
  resource: NotificationResourceDto | null;

  @ApiProperty({
    description: 'Timestamp when marked as read, or null if unread',
    nullable: true,
    example: null,
  })
  readAt: string | null;

  @ApiProperty({ description: 'Timestamp when notification was created' })
  createdAt: string;
}

export class MarkNotificationReadDto {
  @ApiProperty({ description: 'Read state to apply to the notification', example: true })
  @IsBoolean()
  read: boolean;
}

export class CreateNotificationDto {
  userId!: string;
  type!: NotificationType;
  title!: string;
  body!: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

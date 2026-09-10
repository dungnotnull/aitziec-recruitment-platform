import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationType } from '@prisma/client';

export class NotificationQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 20 : parsed;
  })
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
}

export class CreateNotificationDto {
  userId!: string;
  type!: NotificationType;
  title!: string;
  body!: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

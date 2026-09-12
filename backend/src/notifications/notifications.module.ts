import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationProcessor } from './workers/notification.processor';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queues/queue.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [EmailModule, AuthModule, QueueModule, CompaniesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}

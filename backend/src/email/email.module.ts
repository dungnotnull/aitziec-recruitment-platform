import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailProcessor } from './workers/email.processor';
import { QueueModule } from '../queues/queue.module';

@Module({
  imports: [ConfigModule, QueueModule],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}

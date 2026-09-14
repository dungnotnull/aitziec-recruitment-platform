import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobExpirationScheduler } from './job-expiration.scheduler';
import { CompaniesModule } from '../companies/companies.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [CompaniesModule, AuditModule, AuthModule, OutboxModule],
  controllers: [JobsController],
  providers: [JobsService, JobExpirationScheduler],
  exports: [JobsService, JobExpirationScheduler],
})
export class JobsModule {}

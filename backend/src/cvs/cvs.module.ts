import { Module } from '@nestjs/common';
import { CvsController } from './cvs.controller';
import { CvsService } from './cvs.service';
import { CvExtractionProcessor } from './workers/cv-extraction.processor';
import { StorageModule } from '../storage/storage.module';
import { CompaniesModule } from '../companies/companies.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StorageModule, CompaniesModule, AuditModule, OutboxModule, AuthModule],
  controllers: [CvsController],
  providers: [CvsService, CvExtractionProcessor],
  exports: [CvsService],
})
export class CvsModule {}

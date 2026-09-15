import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { CompletenessService } from './completeness.service';

import { StorageModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StorageModule, AuditModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, CompletenessService],
  exports: [CandidatesService, CompletenessService],
})
export class CandidatesModule {}

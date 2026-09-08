import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { CompletenessService } from './completeness.service';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService, CompletenessService],
  exports: [CandidatesService, CompletenessService],
})
export class CandidatesModule {}

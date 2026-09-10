import { Module } from '@nestjs/common';
import { SavedJobsController } from './saved-jobs.controller';
import { SavedJobsService } from './saved-jobs.service';
import { JobsModule } from '../jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [JobsModule, AuthModule],
  controllers: [SavedJobsController],
  providers: [SavedJobsService],
  exports: [SavedJobsService],
})
export class SavedJobsModule {}

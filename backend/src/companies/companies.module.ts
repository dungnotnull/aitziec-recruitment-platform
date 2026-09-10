import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompanyInvitationsController } from './company-invitations.controller';
import { CompaniesService } from './companies.service';
import { CompanyScopeService } from './company-scope.service';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [OutboxModule],
  controllers: [CompaniesController, CompanyInvitationsController],
  providers: [CompaniesService, CompanyScopeService],
  exports: [CompaniesService, CompanyScopeService],
})
export class CompaniesModule {}

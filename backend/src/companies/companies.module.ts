import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompanyInvitationsController } from './company-invitations.controller';
import { CompaniesService } from './companies.service';
import { CompanyScopeService } from './company-scope.service';
import { OutboxModule } from '../outbox/outbox.module';
import { EmailModule } from '../email/email.module';
import { InvitationSecretAdapter } from './adapters/invitation-secret.adapter';
import { InvitationDeliveryWorker } from './workers/invitation-delivery.worker';

@Module({
  imports: [OutboxModule, EmailModule],
  controllers: [CompaniesController, CompanyInvitationsController],
  providers: [
    CompaniesService,
    CompanyScopeService,
    InvitationSecretAdapter,
    InvitationDeliveryWorker,
  ],
  exports: [
    CompaniesService,
    CompanyScopeService,
    InvitationSecretAdapter,
    InvitationDeliveryWorker,
  ],
})
export class CompaniesModule {}

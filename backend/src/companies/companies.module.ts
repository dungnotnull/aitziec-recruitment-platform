import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompanyInvitationsController } from './company-invitations.controller';
import { CompaniesService } from './companies.service';
import { CompanyScopeService } from './company-scope.service';
import { OutboxModule } from '../outbox/outbox.module';
import { EmailModule } from '../email/email.module';
import { InvitationSecretAdapter } from './adapters/invitation-secret.adapter';
import { InvitationDeliveryWorker } from './workers/invitation-delivery.worker';

import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [OutboxModule, EmailModule, StorageModule],
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

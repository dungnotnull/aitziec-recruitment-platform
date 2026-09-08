import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyScopeService } from './company-scope.service';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyScopeService],
  exports: [CompaniesService, CompanyScopeService],
})
export class CompaniesModule {}

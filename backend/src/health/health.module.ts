import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [CompaniesModule],
  controllers: [HealthController],
})
export class HealthModule {}

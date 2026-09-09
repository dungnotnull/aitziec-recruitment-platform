import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { JobsModule } from '../jobs/jobs.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [JobsModule, RedisModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

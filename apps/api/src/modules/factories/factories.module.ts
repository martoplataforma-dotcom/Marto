import { Module } from '@nestjs/common';
import { FactoryInsightsController } from './insights/factory-insights.controller';
import { FactoryInsightsService } from './insights/factory-insights.service';
import { ChannelsModule } from './channels/channels.module';
import { RelationshipsModule } from './relationships/relationships.module';

@Module({
  controllers: [FactoryInsightsController],
  providers: [FactoryInsightsService],
  imports: [ChannelsModule, RelationshipsModule],
})
export class FactoriesModule {}

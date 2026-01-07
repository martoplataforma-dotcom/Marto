import { Module } from '@nestjs/common';
import { InsightsAdvancedController } from './insights-advanced.controller';
import { InsightsAdvancedService } from './insights-advanced.service';

@Module({
  controllers: [InsightsAdvancedController],
  providers: [InsightsAdvancedService],
})
export class InsightsAdvancedModule {}

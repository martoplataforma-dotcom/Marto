import { Controller, Get } from '@nestjs/common';
import { FactoryInsightsService } from './factory-insights.service';

@Controller('factories/insights')
export class FactoryInsightsController {
  constructor(private readonly service: FactoryInsightsService) {}

  @Get('summary')
  summary() {
    return this.service.getSummary();
  }

  @Get('defects-timeseries')
  defectsTimeSeries() {
    return this.service.getDefectsTimeSeries();
  }

  @Get('top-defects')
  topDefects() {
    return this.service.getTopDefects();
  }

  @Get('alerts')
  alerts() {
    return this.service.getAlerts();
  }
}

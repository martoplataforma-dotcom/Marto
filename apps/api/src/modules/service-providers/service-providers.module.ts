import { Module } from '@nestjs/common';
import { ServiceProvidersController } from './service-providers.controller';

@Module({
  controllers: [ServiceProvidersController],
})
export class ServiceProvidersModule {}

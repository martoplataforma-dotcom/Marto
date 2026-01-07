import { Module } from '@nestjs/common';
import { ConsumersController } from './consumers.controller';

@Module({
  controllers: [ConsumersController],
})
export class ConsumersModule {}

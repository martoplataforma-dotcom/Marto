import { Module } from '@nestjs/common';
import { RepresentativesController } from './representatives.controller';

@Module({
  controllers: [RepresentativesController],
})
export class RepresentativesModule {}

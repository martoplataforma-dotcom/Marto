// apps/api/src/modules/transport/transport.module.ts
import { Module } from '@nestjs/common';

import { TransportersController } from './transporters.controller';

@Module({
  controllers: [TransportersController],
})
export class TransportModule {}

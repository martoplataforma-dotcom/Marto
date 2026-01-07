// apps/api/src/modules/identity/me/me.module.ts
import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { PrismaModule } from '../../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}

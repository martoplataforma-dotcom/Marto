import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { FactoriesController } from './factories.controller';
import { FactoriesService } from './factories.service';

@Module({
  controllers: [FactoriesController],
  providers: [FactoriesService, PrismaService, JwtAuthGuard],
})
export class FactoriesModule {}

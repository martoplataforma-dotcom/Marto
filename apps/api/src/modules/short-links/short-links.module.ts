import { Module } from '@nestjs/common';
import { ShortLinksController } from './short-links.controller';
import { ShortLinksMetricsController } from './short-links.metrics.controller';
import { ShortLinksService } from './short-links.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  controllers: [ShortLinksController, ShortLinksMetricsController],
  providers: [ShortLinksService, PrismaService],
})
export class ShortLinksModule {}

// apps/api/src/modules/consumers/consumers.controller.ts

import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('consumers')
export class ConsumersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return null;

    const consumer = await this.prisma.consumer.findUnique({
      where: { userId },
    });

    return consumer;
  }

  // ✅ NOVO: salvar/atualizar perfil do consumidor
  @UseGuards(JwtAuthGuard)
  @Put('me')
  async upsertMe(
    @Req() req: Request,
    @Body()
    body: {
      city?: string;
      cepPrefix?: string;
    },
  ) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return null;

    const consumer = await this.prisma.consumer.upsert({
      where: { userId },
      create: {
        userId,
        city: body.city ?? null,
        cepPrefix: body.cepPrefix ?? null,
      },
      update: {
        city: body.city ?? null,
        cepPrefix: body.cepPrefix ?? null,
      },
    });

    return consumer;
  }
}

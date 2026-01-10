import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('service-providers')
export class ServiceProvidersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return null;

    return this.prisma.serviceProvider.findUnique({
      where: { userId },
      include: { transporter: true },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async upsertMe(
    @Req() req: Request,
    @Body()
    body: {
      cpf: string;
      city?: string;
      cepPrefix?: string;
      kind?: 'GENERIC' | 'TRANSPORTER';
    },
  ) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return null;

    const kind = body.kind ?? 'GENERIC';

    const serviceProvider = await this.prisma.serviceProvider.upsert({
      where: { userId },
      create: {
        userId,
        cpf: body.cpf,
        city: body.city ?? null,
        cepPrefix: body.cepPrefix ?? null,
        status: 'ACTIVE',
        kind: kind as any,
      },
      update: {
        cpf: body.cpf,
        city: body.city ?? null,
        cepPrefix: body.cepPrefix ?? null,
        kind: kind as any,
      },
    });

    if (kind === 'TRANSPORTER') {
      await this.prisma.transporter.upsert({
        where: { serviceProviderId: serviceProvider.id },
        update: {},
        create: {
          serviceProviderId: serviceProvider.id,
          name: 'Transportadora',
          type: 'CARRIER' as any,
          city: serviceProvider.city ?? null,
          state: null,
          active: true,
          serviceArea: null as any,
        },
      });
    }

    return this.prisma.serviceProvider.findUnique({
      where: { id: serviceProvider.id },
      include: { transporter: true },
    });
  }
}

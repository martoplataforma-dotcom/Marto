// apps/api/src/modules/transport/transporters.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';

function getUserId(req: Request): string {
  const u = req.user as { id?: string; sub?: string } | undefined;
  return String(u?.id ?? u?.sub ?? '');
}

type UpsertTransporterBody = {
  name?: string;
  type?: string; // ex: "CARRIER", "FREIGHT", etc (depende do seu enum)
  city?: string | null;
  state?: string | null;
  active?: boolean;
  serviceArea?: unknown; // JSON livre
};

@Controller('transporters/me')
@UseGuards(JwtAuthGuard)
export class TransportersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/transporters/me
   * Retorna a transportadora vinculada ao prestador logado (se existir)
   */
  @Get()
  async me(@Req() req: Request) {
    const userId = getUserId(req);

    const sp = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: {
        id: true,
        transporter: true,
      },
    });

    return {
      ok: true,
      serviceProviderId: sp?.id ?? null,
      transporter: sp?.transporter ?? null,
    };
  }

  /**
   * POST /api/transporters/me
   * Cria ou atualiza a transportadora do prestador logado.
   * (Mínimo para "marcar" o prestador como transportadora)
   */
  @Post()
  async upsert(@Req() req: Request, @Body() body: UpsertTransporterBody) {
    const userId = getUserId(req);

    const sp = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!sp?.id) {
      return {
        ok: false,
        message: 'Prestador não encontrado para este usuário.',
      };
    }

    // 👇 ajuste um default seguro pro seu enum
    const fallbackType = 'CARRIER';

    const transporter = await this.prisma.transporter.upsert({
      where: { serviceProviderId: sp.id },
      update: {
        name: body.name ?? undefined,
        type: (body.type ?? fallbackType) as any,
        city: body.city ?? undefined,
        state: body.state ?? undefined,
        active: typeof body.active === 'boolean' ? body.active : undefined,
        serviceArea: body.serviceArea as any,
      },
      create: {
        name: body.name ?? 'Transportadora',
        type: (body.type ?? fallbackType) as any,
        city: body.city ?? null,
        state: body.state ?? null,
        active: typeof body.active === 'boolean' ? body.active : true,
        serviceArea: (body.serviceArea ?? null) as any,
        serviceProviderId: sp.id,
      },
    });

    return { ok: true, transporter };
  }
}

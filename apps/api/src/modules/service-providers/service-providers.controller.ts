import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { Prisma } from '@prisma/client';

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

    return await this.prisma.serviceProvider.findUnique({
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
      cpf?: string;
      city?: string;
      cepPrefix?: string;

      document?: string;
      documentType?: 'CPF' | 'CNPJ';
      cep?: string;
      address?: unknown;
      kind?: 'GENERIC' | 'TRANSPORTER';
    },
  ) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return null;

    // ----------------------------
    // Documento (novo + legado)
    // ----------------------------
    const docRaw = String(body.document ?? body.cpf ?? '').replace(/\D/g, '');
    const document = docRaw || null;

    const inferredType =
      document && document.length === 14
        ? 'CNPJ'
        : document && document.length === 11
          ? 'CPF'
          : null;

    const documentType = body.documentType ?? inferredType;

    // ----------------------------
    // CEP completo + compat prefixo
    // ----------------------------
    const cepDigits = String(body.cep ?? '')
      .replace(/\D/g, '')
      .slice(0, 8);

    const cep = cepDigits.length === 8 ? cepDigits : null;

    const cepPrefix =
      cep ??
      (String(body.cepPrefix ?? '')
        .replace(/\D/g, '')
        .slice(0, 5) ||
        null);

    const city = body.city ?? null;

    // ----------------------------
    // Kind
    // ----------------------------
    const kind = body.kind === 'TRANSPORTER' ? 'TRANSPORTER' : 'GENERIC';

    // ----------------------------
    // UPSERT SERVICE PROVIDER
    // ----------------------------
    const serviceProvider = await this.prisma.serviceProvider.upsert({
      where: { userId },
      create: {
        userId,
        cpf: document ?? '00000000000',
        cepPrefix,
        city,
        status: 'ACTIVE',
        kind,
        document,
        documentType,
        cep,
        address: body.address ?? Prisma.JsonNull,
      },
      update: {
        cpf: document ?? undefined,
        cepPrefix,
        city,
        kind,
        document,
        documentType,
        cep,
        address: body.address ?? Prisma.JsonNull,
      },
    });

    // ----------------------------
    // GARANTE TRANSPORTER
    // ----------------------------
    if (kind === 'TRANSPORTER') {
      await this.prisma.transporter.upsert({
        where: { serviceProviderId: serviceProvider.id },
        update: {},
        create: {
          serviceProviderId: serviceProvider.id,
          name: 'Transportadora',
          type: 'CARRIER',
          city: serviceProvider.city ?? null,
          state: null,
          active: true,
          serviceArea: Prisma.JsonNull,
        },
      });
    }

    // ----------------------------
    // RESPOSTA COMPLETA
    // ----------------------------
    return this.prisma.serviceProvider.findUnique({
      where: { id: serviceProvider.id },
      include: { transporter: true },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/specialties')
  async updateSpecialties(
    @Req() req: Request,
    @Body() body: { specialties?: unknown },
  ) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return { ok: false, message: 'Unauthorized' };

    const specialties = Array.isArray(body?.specialties)
      ? body.specialties.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const updated = await this.prisma.serviceProvider.update({
      where: { userId },
      data: { specialties },
      select: { id: true, userId: true, kind: true, specialties: true },
    });

    return { ok: true, serviceProvider: updated };
  }
}

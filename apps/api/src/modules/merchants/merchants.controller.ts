import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

type UpsertMerchantBody = {
  tradeName: string;
  document: string;
  handle?: string | null;
  city?: string | null;
  cepPrefix?: string | null;
  originZipCode?: string | null;
  supportsCorreios?: boolean | null;
  supportsTransportadora?: boolean | null;
  supportsLocalDelivery?: boolean | null;
  supportsPickup?: boolean | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

type UpdateMerchantLogisticsBody = {
  originZipCode?: string;
  supportsCorreios?: boolean;
  supportsTransportadora?: boolean;
  supportsLocalDelivery?: boolean;
  supportsPickup?: boolean;
};

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🔎 GET /api/merchants/me
   * Retorna o perfil do lojista logado
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    return this.prisma.merchant.findUnique({
      where: { userId },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/logistics')
  async updateMyLogistics(
    @Req() req: Request,
    @Body() body: UpdateMerchantLogisticsBody,
  ) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    return this.prisma.merchant.update({
      where: { userId },
      data: {
        ...(body.originZipCode !== undefined
          ? { originZipCode: body.originZipCode }
          : {}),
        ...(body.supportsCorreios !== undefined
          ? { supportsCorreios: body.supportsCorreios }
          : {}),
        ...(body.supportsTransportadora !== undefined
          ? { supportsTransportadora: body.supportsTransportadora }
          : {}),
        ...(body.supportsLocalDelivery !== undefined
          ? { supportsLocalDelivery: body.supportsLocalDelivery }
          : {}),
        ...(body.supportsPickup !== undefined
          ? { supportsPickup: body.supportsPickup }
          : {}),
      },
    });
  }

  /**
   * ✏️ PUT /api/merchants/me
   * Cria ou atualiza (upsert) o perfil do lojista
   *
   * Regras:
   * - tradeName obrigatório
   * - Lojista exige CNPJ (14 números)
   * - handle opcional (sem @ no banco) | 3–30 chars | [a-z0-9._]
   * - city opcional
   * - cepPrefix opcional (5 números)
   * ·
   */
  @UseGuards(JwtAuthGuard)
  @Put('me')
  async upsertMe(@Req() req: Request, @Body() body: UpsertMerchantBody) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    const tradeName = String(body?.tradeName ?? '').trim();

    // 🔒 Lojista: CNPJ obrigatório (14 dígitos)
    const rawDoc = String(body?.document ?? '').trim();
    const document = rawDoc.replace(/\D/g, '');

    // ✅ handle público (opcional) — salva sem "@"
    const handleRaw = String(body?.handle ?? '').trim();
    const handle = handleRaw
      ? handleRaw.replace(/^@+/, '').toLowerCase()
      : null;

    // cidade é opcional
    const cityRaw = String(body?.city ?? '').trim();
    const city = cityRaw ? cityRaw : null;

    // CEP prefixo opcional (5 dígitos)
    const cepRaw = String(body?.cepPrefix ?? '').trim();
    const cepPrefix = cepRaw ? cepRaw.replace(/\D/g, '').slice(0, 5) : null;

    if (!tradeName) {
      throw new BadRequestException('tradeName obrigatório');
    }

    if (!document) {
      throw new BadRequestException('CNPJ obrigatório');
    }

    if (!/^\d{14}$/.test(document)) {
      throw new BadRequestException('CNPJ inválido. Informe 14 números.');
    }

    if (handle) {
      // letras, números, _ e . | 3 a 30 chars
      if (!/^[a-z0-9._]{3,30}$/.test(handle)) {
        throw new BadRequestException(
          'Handle inválido. Use 3–30 caracteres: letras/números e . _ (sem espaços).',
        );
      }
    }

    if (cepPrefix && !/^\d{5}$/.test(cepPrefix)) {
      throw new BadRequestException(
        'CEP (prefixo) deve ter 5 números (ex: 36500).',
      );
    }

    try {
      const createData: Record<string, unknown> = {
        userId,
        tradeName,
        document,
        handle,
        city,
        cepPrefix,
        logoUrl: body.logoUrl ?? null,
        coverUrl: body.coverUrl ?? null,
        status: 'ACTIVE',
      };

      const updateData: Record<string, unknown> = {
        tradeName,
        document,
        handle,
        city,
        cepPrefix,
        logoUrl: body.logoUrl ?? null,
        coverUrl: body.coverUrl ?? null,
      };

      if (body.originZipCode !== undefined) {
        createData.originZipCode = body.originZipCode;
        updateData.originZipCode = body.originZipCode;
      }

      if (body.supportsCorreios !== undefined) {
        createData.supportsCorreios = body.supportsCorreios;
        updateData.supportsCorreios = body.supportsCorreios;
      }

      if (body.supportsTransportadora !== undefined) {
        createData.supportsTransportadora = body.supportsTransportadora;
        updateData.supportsTransportadora = body.supportsTransportadora;
      }

      if (body.supportsLocalDelivery !== undefined) {
        createData.supportsLocalDelivery = body.supportsLocalDelivery;
        updateData.supportsLocalDelivery = body.supportsLocalDelivery;
      }

      if (body.supportsPickup !== undefined) {
        createData.supportsPickup = body.supportsPickup;
        updateData.supportsPickup = body.supportsPickup;
      }

      return await this.prisma.merchant.upsert({
        where: { userId },
        create: createData as any,
        update: updateData as any,
      });
    } catch (e: any) {
      if (
        e?.code === 'P2002' &&
        Array.isArray(e?.meta?.target) &&
        e.meta.target.includes('handle')
      ) {
        throw new ConflictException(
          'Este handle já está em uso. Escolha outro.',
        );
      }
      throw e;
    }
  }
}

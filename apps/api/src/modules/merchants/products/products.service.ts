import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByUserId(userId: string) {
    if (!userId) throw new UnauthorizedException('Sem usuário.');

    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!merchant) {
      return { ok: true, items: [] };
    }

    const items = await this.prisma.product.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        active: true,
        images: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { ok: true, items };
  }

  async createByUserId(
    userId: string,
    body: { title: string; description?: string | null; priceCents: number },
  ) {
    if (!userId) throw new UnauthorizedException('Sem usuário.');

    const title = String(body?.title ?? '').trim();
    const description =
      body?.description === null || body?.description === undefined
        ? null
        : String(body.description).trim();

    const priceCents = Number(body?.priceCents ?? 0);

    if (!title) return { ok: false, message: 'Título é obrigatório.' };
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      return { ok: false, message: 'priceCents deve ser inteiro > 0.' };
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!merchant) {
      return { ok: false, message: 'Perfil de lojista não encontrado.' };
    }

    const created = await this.prisma.product.create({
      data: {
        merchantId: merchant.id,
        title,
        description,
        priceCents,
        active: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        active: true,
        createdAt: true,
      },
    });

    return { ok: true, created };
  }
}

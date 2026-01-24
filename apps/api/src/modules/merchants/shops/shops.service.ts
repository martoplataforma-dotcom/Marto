import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicShop(merchantId: string) {
    const id = String(merchantId ?? '').trim();
    if (!id) throw new NotFoundException('Loja não encontrada.');

    const m = await this.prisma.merchant.findUnique({
      where: { id },
      select: {
        id: true,
        tradeName: true,
        city: true,
        cepPrefix: true,
        status: true,
        logoUrl: true,
        coverUrl: true,
      },
    });

    if (!m) throw new NotFoundException('Loja não encontrada.');
    return m;
  }

  async listPublicShopProducts(merchantId: string) {
    const id = String(merchantId ?? '').trim();
    if (!id) throw new NotFoundException('Loja não encontrada.');

    // Confere se a loja existe (evita “vazio silencioso”)
    const exists = await this.prisma.merchant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Loja não encontrada.');

    const items = await this.prisma.product.findMany({
      where: {
        merchantId: id,
        active: true, // ✅ só público/ativo
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        priceCents: true,
        active: true,
        images: true,
        createdAt: true,
      },
    });

    return { ok: true, items };
  }

  // ✅ NOVO: loja pública por handle
  async getPublicShopByHandle(handleRaw: string) {
    const h = String(handleRaw ?? '')
      .trim()
      .toLowerCase()
      .replace(/^@+/, '');

    if (!h) throw new NotFoundException('Loja não encontrada.');

    const m = await this.prisma.merchant.findUnique({
      where: { handle: h },
      select: {
        id: true,
        handle: true,
        tradeName: true,
        city: true,
        cepPrefix: true,
        status: true,
        logoUrl: true,
        coverUrl: true,
      },
    });

    if (!m) throw new NotFoundException('Loja não encontrada.');
    return m;
  }

  // ✅ NOVO: produtos públicos por handle (reaproveita a lógica por ID)
  async listPublicShopProductsByHandle(handleRaw: string) {
    const h = String(handleRaw ?? '')
      .trim()
      .toLowerCase()
      .replace(/^@+/, '');

    if (!h) throw new NotFoundException('Loja não encontrada.');

    const m = await this.prisma.merchant.findUnique({
      where: { handle: h },
      select: { id: true },
    });

    if (!m) throw new NotFoundException('Loja não encontrada.');

    // ✅ reaproveita lógica existente
    return this.listPublicShopProducts(m.id);
  }
}

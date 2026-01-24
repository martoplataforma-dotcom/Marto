import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ShopsService } from './shops.service';

@Controller('shops')
export class ShopsController {
  constructor(
    private readonly shops: ShopsService,
    private readonly prisma: PrismaService,
  ) {}

  // ✅ NOVO: GET /api/shops/handle/:handle
  // Ex: /api/shops/handle/store5
  @Get('handle/:handle')
  async getPublicShopByHandle(@Param('handle') handle: string) {
    const h = String(handle ?? '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();

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

  // ✅ NOVO: GET /api/shops/handle/:handle/products
  @Get('handle/:handle/products')
  async listPublicShopProductsByHandle(@Param('handle') handle: string) {
    const h = String(handle ?? '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();

    if (!h) throw new NotFoundException('Loja não encontrada.');

    const m = await this.prisma.merchant.findUnique({
      where: { handle: h },
      select: { id: true },
    });

    if (!m) throw new NotFoundException('Loja não encontrada.');

    const items = await this.prisma.product.findMany({
      where: { merchantId: m.id, active: true },
      orderBy: { createdAt: 'desc' },
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

  // ✅ EXISTENTE: GET /api/shops/:id
  @Get(':id')
  getPublicShop(@Param('id') id: string) {
    return this.shops.getPublicShop(id);
  }

  // ✅ EXISTENTE: GET /api/shops/:id/products
  @Get(':id/products')
  listPublicShopProducts(@Param('id') id: string) {
    return this.shops.listPublicShopProducts(id);
  }
}

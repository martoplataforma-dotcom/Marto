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
}

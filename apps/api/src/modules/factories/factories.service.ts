import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type UpsertFactoryBody = {
  tradeName: string;
  legalName?: string | null;
  document: string;
  city?: string | null;
  state?: string | null;
  originZipCode?: string | null;
  supportsCorreios?: boolean | null;
  supportsTransportadora?: boolean | null;
  supportsLocalDelivery?: boolean | null;
  supportsPickup?: boolean | null;
};

type UpdateFactoryLogisticsBody = {
  originZipCode?: string;
  supportsCorreios?: boolean;
  supportsTransportadora?: boolean;
  supportsLocalDelivery?: boolean;
  supportsPickup?: boolean;
};

@Injectable()
export class FactoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    const factory = await this.prisma.factory.findUnique({
      where: { userId },
    });

    return { ok: true, factory };
  }

  async upsertMe(userId: string, body: UpsertFactoryBody) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    const tradeName = String(body?.tradeName ?? '').trim();
    const document = String(body?.document ?? '')
      .replace(/\D/g, '')
      .trim();

    if (!tradeName) {
      throw new BadRequestException('tradeName é obrigatório.');
    }

    if (!document) {
      throw new BadRequestException('document (CNPJ) é obrigatório.');
    }

    const createData: Record<string, unknown> = {
      userId,
      tradeName,
      legalName: body.legalName ?? null,
      document,
      city: body.city ?? null,
      state: body.state ?? null,
    };

    const updateData: Record<string, unknown> = {
      tradeName,
      legalName: body.legalName ?? null,
      document,
      city: body.city ?? null,
      state: body.state ?? null,
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

    const factory = await this.prisma.factory.upsert({
      where: { userId },
      create: createData as any,
      update: updateData as any,
    });

    return { ok: true, factory };
  }

  async updateMyLogistics(userId: string, body: UpdateFactoryLogisticsBody) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    return this.prisma.factory.update({
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

  async ordersSummaryForMe(userId: string) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    const merchants = await this.prisma.merchant.findMany({
      where: { userId },
      select: { id: true },
    });

    const merchantIds = merchants.map((m) => m.id);

    if (merchantIds.length === 0) {
      return { ok: true, counts: {}, needsActionCount: 0, needsAction: [] };
    }

    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: { merchantId: { in: merchantIds } },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const g of grouped) {
      counts[String(g.status)] = g._count?._all ?? 0;
    }

    const actionStatuses: OrderStatus[] = [
      'CONFIRMED_BY_SELLER',
      'READY_FOR_PICKUP',
      'RETURN_REQUESTED',
    ];

    const needsAction = await this.prisma.order.findMany({
      where: {
        merchantId: { in: merchantIds },
        status: { in: actionStatuses },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        city: true,
        state: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    return {
      ok: true,
      counts,
      needsActionCount: needsAction.length,
      needsAction,
    };
  }

  async catalogSummaryForMe(userId: string) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    const merchants = await this.prisma.merchant.findMany({
      where: { userId },
      select: { id: true },
    });

    const merchantIds = merchants.map((m) => m.id);

    if (merchantIds.length === 0) {
      return { ok: true, activeCount: 0, inactiveCount: 0, total: 0 };
    }

    const [activeCount, inactiveCount] = await Promise.all([
      this.prisma.product.count({
        where: { merchantId: { in: merchantIds }, active: true },
      }),
      this.prisma.product.count({
        where: { merchantId: { in: merchantIds }, active: false },
      }),
    ]);

    return {
      ok: true,
      activeCount,
      inactiveCount,
      total: activeCount + inactiveCount,
    };
  }

  // ✅ ALTERADO: topProductsForMe (conforme pedido)
  async topProductsForMe(userId: string) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    const merchants = await this.prisma.merchant.findMany({
      where: { userId },
      select: { id: true },
    });

    const merchantIds = merchants.map((m) => m.id);

    if (merchantIds.length === 0) {
      return { ok: true, items: [] };
    }

    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          merchantId: { in: merchantIds },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const productIds = grouped.map((g) => g.productId);

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true, active: true, priceCents: true },
    });

    const byId = new Map(products.map((p) => [p.id, p]));

    const items = grouped.map((g) => {
      const p = byId.get(g.productId);
      return {
        productId: g.productId,
        title: p?.title ?? 'Produto',
        active: Boolean(p?.active ?? false),
        priceCents: Number(p?.priceCents ?? 0),
        unitsSold: Number(g._sum?.quantity ?? 0),
      };
    });

    return { ok: true, items };
  }
}

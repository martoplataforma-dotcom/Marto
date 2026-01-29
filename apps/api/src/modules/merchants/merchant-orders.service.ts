// apps/api/src/modules/merchants/merchant-orders.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MerchantOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyOrders(merchantId: string, take = 20) {
    const safeTake = Math.min(Math.max(Number(take || 20), 1), 50);

    const orders = await this.prisma.order.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: safeTake,
      select: {
        id: true,
        status: true,
        createdAt: true,
        city: true,
        state: true,
      },
    });

    return {
      ok: true,
      items: orders.map((o) => ({
        id: o.id,
        status: String(o.status ?? ''),
        createdAt: o.createdAt,
        city: o.city ?? null,
        state: o.state ?? null,
      })),
    };
  }

  async summaryMyOrders(merchantId: string) {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      where: { merchantId },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const r of rows) {
      const key = String(r.status ?? 'UNKNOWN');
      counts[key] = Number(r._count?._all ?? 0);
    }

    // ✅ alinhado com o que apareceu no seu summary real
    // (a gente refina depois quando você quiser)
    const doneStatuses = new Set(['COMPLETED', 'DELIVERED']);

    const needsActionCount = Object.entries(counts).reduce((acc, [k, v]) => {
      return doneStatuses.has(k) ? acc : acc + v;
    }, 0);

    // ✅ Top 3 pendências (mais recentes)
    const needsAction = await this.prisma.order.findMany({
      where: {
        merchantId,
        status: { notIn: Array.from(doneStatuses) as any },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        status: true,
        createdAt: true,
        city: true,
        state: true,
      },
    });

    return {
      ok: true,
      counts,
      needsActionCount,
      needsAction: needsAction.map((o) => ({
        id: o.id,
        status: String(o.status ?? ''),
        createdAt: o.createdAt,
        city: o.city ?? null,
        state: o.state ?? null,
      })),
    };
  }
}

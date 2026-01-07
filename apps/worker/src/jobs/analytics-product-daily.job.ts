import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RegionKey = string;

function normalizeRegionFromOrder(order: { city?: string | null; state?: string | null }) {
  const state = (order.state ?? 'NA').trim().toUpperCase();
  const city = (order.city ?? 'NA').trim().toUpperCase();
  return `${state}|${city}` as RegionKey;
}

export async function runAnalyticsProductDailySnapshot(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      // opcional: só pedidos "válidos" (ajuste se quiser)
      // status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
    },
    select: {
      merchantId: true,
      city: true,
      state: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });

  const map = new Map<
    string,
    {
      date: Date;
      productId: string;
      merchantId: string;
      region: string;
      ordersCount: number;
      unitsSold: number;
      grossRevenue: number;
      avgPriceAccumulator: number;
    }
  >();

  for (const order of orders) {
    const region = normalizeRegionFromOrder(order);
    const perProductSeen = new Set<string>();

    for (const item of order.items) {
      const key = `${start.toISOString()}|${item.productId}|${region}`;

      if (!map.has(key)) {
        map.set(key, {
          date: start,
          productId: item.productId,
          merchantId: order.merchantId,
          region,
          ordersCount: 0,
          unitsSold: 0,
          grossRevenue: 0,
          avgPriceAccumulator: 0,
        });
      }

      const agg = map.get(key)!;

      if (!perProductSeen.has(item.productId)) {
        agg.ordersCount += 1;
        perProductSeen.add(item.productId);
      }

      const qty = item.quantity ?? 0;
      const unitPrice = Number(item.unitPrice ?? 0);

      agg.unitsSold += qty;
      agg.grossRevenue += qty * unitPrice;
      agg.avgPriceAccumulator += unitPrice * qty;
    }
  }

  for (const agg of map.values()) {
    const avgPrice = agg.unitsSold > 0 ? agg.avgPriceAccumulator / agg.unitsSold : 0;

    await prisma.analyticsProductDaily.upsert({
      where: {
        date_productId_region: {
          date: agg.date,
          productId: agg.productId,
          region: agg.region,
        },
      },
      create: {
        date: agg.date,
        productId: agg.productId,
        merchantId: agg.merchantId,
        region: agg.region,
        ordersCount: agg.ordersCount,
        unitsSold: agg.unitsSold,
        grossRevenue: agg.grossRevenue,
        avgPrice,
        reviewsCount: 0,
      },
      update: {
        merchantId: agg.merchantId,
        ordersCount: agg.ordersCount,
        unitsSold: agg.unitsSold,
        grossRevenue: agg.grossRevenue,
        avgPrice,
      },
    });
  }

  return { insertedOrUpdated: map.size, date: start.toISOString() };
}

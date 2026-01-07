import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

type ProductsReportQuery = {
  dateFrom: string;
  dateTo: string;
  merchantId?: string;
  region?: string;
  productId?: string;
};

type CompareProductsQuery = {
  // Período A
  aFrom: string;
  aTo: string;
  // Período B
  bFrom: string;
  bTo: string;

  merchantId?: string;
  region?: string;
  productId?: string;
};

type BenchmarkProductsQuery = {
  dateFrom: string;
  dateTo: string;

  // quem está pedindo o benchmark (obrigatório)
  merchantId: string;

  // filtros opcionais
  region?: string;
  productId?: string;

  // se true: remove o próprio merchant do "mercado" (recomendado)
  excludeSelf?: boolean;
};

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function ratioVsMarket(value: number, market: number) {
  if (market === 0) return value === 0 ? 1 : 999; // evita divisão por zero
  return value / market;
}

@Injectable()
export class InsightsAdvancedService {
  private readonly prisma = new PrismaClient();

  async productsReport(q: ProductsReportQuery) {
    const dateFrom = new Date(q.dateFrom);
    const dateTo = new Date(q.dateTo);

    const where: Prisma.AnalyticsProductDailyWhereInput = {
      date: { gte: dateFrom, lte: dateTo },
      merchantId: q.merchantId,
      region: q.region,
      productId: q.productId,
    };

    const rows = await this.prisma.analyticsProductDaily.groupBy({
      by: ['productId'],
      where,
      _sum: {
        ordersCount: true,
        unitsSold: true,
        grossRevenue: true,
      },
      _avg: {
        avgPrice: true,
        avgRating: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          grossRevenue: 'desc',
        },
      },
    });

    return {
      range: {
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
      filters: {
        merchantId: q.merchantId ?? null,
        region: q.region ?? null,
        productId: q.productId ?? null,
      },
      totals: {
        products: rows.length,
      },
      items: rows.map((r: any) => ({
        productId: r.productId as string,
        days: (r._count?._all ?? 0) as number,
        ordersCount: (r._sum?.ordersCount ?? 0) as number,
        unitsSold: (r._sum?.unitsSold ?? 0) as number,
        grossRevenue: (r._sum?.grossRevenue ??
          new Prisma.Decimal(0)) as Prisma.Decimal,
        avgPrice: (r._avg?.avgPrice ?? null) as Prisma.Decimal | null,
        avgRating: (r._avg?.avgRating ?? null) as Prisma.Decimal | null,
      })),
    };
  }

  async compareProductsReport(q: CompareProductsQuery) {
    const aFrom = new Date(q.aFrom);
    const aTo = new Date(q.aTo);
    const bFrom = new Date(q.bFrom);
    const bTo = new Date(q.bTo);

    const baseWhere = {
      merchantId: q.merchantId,
      region: q.region,
      productId: q.productId,
    };

    const aRows = await this.prisma.analyticsProductDaily.groupBy({
      by: ['productId'],
      where: {
        ...baseWhere,
        date: { gte: aFrom, lte: aTo },
      } as any,
      _sum: {
        ordersCount: true,
        unitsSold: true,
        grossRevenue: true,
      },
      _avg: {
        avgPrice: true,
        avgRating: true,
      },
    });

    const bRows = await this.prisma.analyticsProductDaily.groupBy({
      by: ['productId'],
      where: {
        ...baseWhere,
        date: { gte: bFrom, lte: bTo },
      } as any,
      _sum: {
        ordersCount: true,
        unitsSold: true,
        grossRevenue: true,
      },
      _avg: {
        avgPrice: true,
        avgRating: true,
      },
    });

    const aMap = new Map<string, any>();
    for (const r of aRows as any[]) aMap.set(r.productId as string, r);

    const bMap = new Map<string, any>();
    for (const r of bRows as any[]) bMap.set(r.productId as string, r);

    const productIds = new Set<string>([
      ...Array.from(aMap.keys()),
      ...Array.from(bMap.keys()),
    ]);

    const items = Array.from(productIds).map((productId) => {
      const a = aMap.get(productId);
      const b = bMap.get(productId);

      const aOrders = Number(a?._sum?.ordersCount ?? 0);
      const bOrders = Number(b?._sum?.ordersCount ?? 0);

      const aUnits = Number(a?._sum?.unitsSold ?? 0);
      const bUnits = Number(b?._sum?.unitsSold ?? 0);

      const aRev = Number(a?._sum?.grossRevenue ?? 0);
      const bRev = Number(b?._sum?.grossRevenue ?? 0);

      return {
        productId,

        a: {
          ordersCount: aOrders,
          unitsSold: aUnits,
          grossRevenue: a?._sum?.grossRevenue ?? new Prisma.Decimal(0),
          avgPrice: a?._avg?.avgPrice ?? null,
          avgRating: a?._avg?.avgRating ?? null,
        },

        b: {
          ordersCount: bOrders,
          unitsSold: bUnits,
          grossRevenue: b?._sum?.grossRevenue ?? new Prisma.Decimal(0),
          avgPrice: b?._avg?.avgPrice ?? null,
          avgRating: b?._avg?.avgRating ?? null,
        },

        delta: {
          ordersCount: bOrders - aOrders,
          ordersPct: pctChange(bOrders, aOrders),

          unitsSold: bUnits - aUnits,
          unitsPct: pctChange(bUnits, aUnits),

          grossRevenue: bRev - aRev,
          revenuePct: pctChange(bRev, aRev),
        },
      };
    });

    items.sort(
      (x, y) => Number(y.delta.revenuePct) - Number(x.delta.revenuePct),
    );

    return {
      periods: {
        a: { from: aFrom.toISOString(), to: aTo.toISOString() },
        b: { from: bFrom.toISOString(), to: bTo.toISOString() },
      },
      filters: {
        merchantId: q.merchantId ?? null,
        region: q.region ?? null,
        productId: q.productId ?? null,
      },
      totals: { products: items.length },
      items,
    };
  }

  async benchmarkProductsReport(q: BenchmarkProductsQuery) {
    const dateFrom = new Date(q.dateFrom);
    const dateTo = new Date(q.dateTo);

    const baseWhere: any = {
      date: { gte: dateFrom, lte: dateTo },
    };

    if (q.region) baseWhere.region = q.region;
    if (q.productId) baseWhere.productId = q.productId;

    // 1) "Eu" (merchant solicitante)
    const mine = await this.prisma.analyticsProductDaily.groupBy({
      by: ['productId'],
      where: {
        ...baseWhere,
        merchantId: q.merchantId,
      },
      _sum: {
        ordersCount: true,
        unitsSold: true,
        grossRevenue: true,
      },
      _avg: {
        avgPrice: true,
        avgRating: true,
      },
      _count: {
        _all: true,
      },
    });

    // 2) "Mercado" (anonimizado)
    //    Se excludeSelf=true, removemos o merchantId do mercado.
    const marketWhere: any = {
      ...baseWhere,
    };

    if (q.excludeSelf) {
      marketWhere.merchantId = { not: q.merchantId };
    }

    const market = await this.prisma.analyticsProductDaily.groupBy({
      by: ['productId'],
      where: marketWhere,
      _sum: {
        ordersCount: true,
        unitsSold: true,
        grossRevenue: true,
      },
      _avg: {
        avgPrice: true,
        avgRating: true,
      },
      _count: {
        _all: true,
      },
    });

    const mineMap = new Map<string, any>();
    for (const r of mine as any[]) mineMap.set(r.productId as string, r);

    const marketMap = new Map<string, any>();
    for (const r of market as any[]) marketMap.set(r.productId as string, r);

    const productIds = new Set<string>([
      ...Array.from(mineMap.keys()),
      ...Array.from(marketMap.keys()),
    ]);

    const items = Array.from(productIds).map((productId) => {
      const m = mineMap.get(productId);
      const mk = marketMap.get(productId);

      const mOrders = Number(m?._sum?.ordersCount ?? 0);
      const mkOrders = Number(mk?._sum?.ordersCount ?? 0);

      const mUnits = Number(m?._sum?.unitsSold ?? 0);
      const mkUnits = Number(mk?._sum?.unitsSold ?? 0);

      const mRev = Number(m?._sum?.grossRevenue ?? 0);
      const mkRev = Number(mk?._sum?.grossRevenue ?? 0);

      const mAvgPrice = Number(m?._avg?.avgPrice ?? 0);
      const mkAvgPrice = Number(mk?._avg?.avgPrice ?? 0);

      const mAvgRating = m?._avg?.avgRating ?? null;
      const mkAvgRating = mk?._avg?.avgRating ?? null;

      return {
        productId,

        mine: {
          days: Number(m?._count?._all ?? 0),
          ordersCount: mOrders,
          unitsSold: mUnits,
          grossRevenue: m?._sum?.grossRevenue ?? '0',
          avgPrice: m?._avg?.avgPrice ?? null,
          avgRating: mAvgRating,
        },

        market: {
          days: Number(mk?._count?._all ?? 0),
          ordersCount: mkOrders,
          unitsSold: mkUnits,
          grossRevenue: mk?._sum?.grossRevenue ?? '0',
          avgPrice: mk?._avg?.avgPrice ?? null,
          avgRating: mkAvgRating,
        },

        vsMarket: {
          // 1.0 = igual ao mercado | 1.2 = 20% acima | 0.8 = 20% abaixo
          ordersRatio: ratioVsMarket(mOrders, mkOrders),
          unitsRatio: ratioVsMarket(mUnits, mkUnits),
          revenueRatio: ratioVsMarket(mRev, mkRev),
          priceRatio: ratioVsMarket(mAvgPrice, mkAvgPrice),
        },
      };
    });

    // ordena pelos maiores acima do mercado (receita)
    items.sort(
      (a, b) =>
        Number(b.vsMarket.revenueRatio) - Number(a.vsMarket.revenueRatio),
    );

    return {
      range: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
      mode: {
        excludeSelf: q.excludeSelf ?? false,
        anon: true,
      },
      filters: {
        merchantId: q.merchantId,
        region: q.region ?? null,
        productId: q.productId ?? null,
      },
      totals: { products: items.length },
      items,
    };
  }
}

import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { InsightsAdvancedService } from './insights-advanced.service';

type ProductsReportItemSafe = {
  productId: string;
  days: number;
  ordersCount: number;
  unitsSold: number;
  grossRevenue: string;
  avgPrice: string;
  avgRating: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v === 'object' && v !== null) return v as Record<string, unknown>;
  return null;
}

function toStringSafe(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function toNumberSafe(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
    return Number(v);
  return 0;
}

function normalizeProductsReportItems(
  items: unknown,
): ProductsReportItemSafe[] {
  if (!Array.isArray(items)) return [];

  const out: ProductsReportItemSafe[] = [];

  for (const raw of items) {
    const r = asRecord(raw);
    if (!r) continue;

    out.push({
      productId: toStringSafe(r.productId),
      days: toNumberSafe(r.days),
      ordersCount: toNumberSafe(r.ordersCount),
      unitsSold: toNumberSafe(r.unitsSold),
      grossRevenue: toStringSafe(r.grossRevenue),
      avgPrice: toStringSafe(r.avgPrice),
      avgRating: toStringSafe(r.avgRating),
    });
  }

  return out;
}

@Controller('insights-advanced')
export class InsightsAdvancedController {
  private readonly prisma: PrismaClient;

  constructor(private readonly service: InsightsAdvancedService) {
    this.prisma = new PrismaClient();
  }

  @Get('products')
  async products(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('merchantId') merchantId?: string,
    @Query('region') region?: string,
    @Query('productId') productId?: string,
  ) {
    if (!dateFrom || !dateTo) {
      return {
        error: 'Missing required query params: dateFrom, dateTo',
      };
    }

    return this.service.productsReport({
      dateFrom,
      dateTo,
      merchantId,
      region,
      productId,
    });
  }

  @Get('products/compare')
  async compareProducts(
    @Query('aFrom') aFrom: string,
    @Query('aTo') aTo: string,
    @Query('bFrom') bFrom: string,
    @Query('bTo') bTo: string,
    @Query('merchantId') merchantId?: string,
    @Query('region') region?: string,
    @Query('productId') productId?: string,
  ) {
    if (!aFrom || !aTo || !bFrom || !bTo) {
      return {
        error: 'Missing required query params: aFrom, aTo, bFrom, bTo',
      };
    }

    return this.service.compareProductsReport({
      aFrom,
      aTo,
      bFrom,
      bTo,
      merchantId,
      region,
      productId,
    });
  }

  @Get('products/benchmark')
  async benchmarkProducts(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('merchantId') merchantId: string,
    @Query('region') region?: string,
    @Query('productId') productId?: string,
    @Query('excludeSelf') excludeSelf?: string,
  ) {
    if (!dateFrom || !dateTo || !merchantId) {
      return {
        error: 'Missing required query params: merchantId, dateFrom, dateTo',
      };
    }

    return this.service.benchmarkProductsReport({
      merchantId,
      dateFrom,
      dateTo,
      region,
      productId,
      excludeSelf: excludeSelf === 'true',
    });
  }

  @Get('products/export.csv')
  async exportProductsCsv(
    @Req() req: Request,
    @Res() res: Response,
    @Query('token') token: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('merchantId') merchantId?: string,
    @Query('region') region?: string,
    @Query('productId') productId?: string,
  ) {
    const expectedToken = process.env.EXPORT_TOKEN;

    if (!expectedToken) {
      return res.status(500).json({
        error: 'EXPORT_TOKEN not configured',
      });
    }

    if (!token || token !== expectedToken) {
      return res.status(401).json({
        error: 'Unauthorized export',
      });
    }

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        error: 'Missing required query params: dateFrom, dateTo',
      });
    }

    const report = await this.service.productsReport({
      dateFrom,
      dateTo,
      merchantId,
      region,
      productId,
    });

    const totals = (report as unknown as { totals?: unknown }).totals ?? null;

    await (this.prisma as any).exportLog.create({
      data: {
        resource: 'INSIGHTS_PRODUCTS_REPORT',
        format: 'CSV',
        merchantId: merchantId ?? null,
        params: {
          dateFrom,
          dateTo,
          merchantId: merchantId ?? null,
          region: region ?? null,
          productId: productId ?? null,
          totals,
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });

    const safeItems = normalizeProductsReportItems(
      (report as unknown as { items?: unknown }).items ?? [],
    );

    const header = [
      'productId',
      'days',
      'ordersCount',
      'unitsSold',
      'grossRevenue',
      'avgPrice',
      'avgRating',
    ].join(',');

    const lines: string[] = [];
    for (const it of safeItems) {
      lines.push(
        [
          it.productId,
          it.days,
          it.ordersCount,
          it.unitsSold,
          it.grossRevenue,
          it.avgPrice,
          it.avgRating,
        ].join(','),
      );
    }

    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="marto_insights_products_${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    );

    return res.status(200).send(csv);
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ShortLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveAndTrack(code: string, meta: { userAgent?: string; referer?: string; ip?: string }) {
    const link = await this.prisma.publicLink.findUnique({
      where: { code },
      select: { id: true, targetPath: true },
    });

    if (!link) return null;

    const ipHash = meta.ip
      ? crypto.createHash('sha256').update(meta.ip).digest('hex').slice(0, 32)
      : null;

    await this.prisma.publicScan.create({
      data: {
        linkId: link.id,
        userAgent: meta.userAgent ?? null,
        referer: meta.referer ?? null,
        ipHash,
      },
    });

    return link.targetPath;
  }

  async getMetrics(code: string, ownerUserId: string) {
    const link = await this.prisma.publicLink.findUnique({
      where: { code },
      select: { id: true, code: true, targetPath: true, ownerUserId: true, createdAt: true },
    });

    if (!link) return null;
    if (String(link.ownerUserId ?? '') !== String(ownerUserId)) return 'forbidden' as const;

    const now = new Date();
    const d = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    const since7 = d(7);
    const since30 = d(30);
    const since14 = d(14);

    const [total, last7, last30, scans14, last10] = await Promise.all([
      this.prisma.publicScan.count({ where: { linkId: link.id } }),
      this.prisma.publicScan.count({ where: { linkId: link.id, createdAt: { gte: since7 } } }),
      this.prisma.publicScan.count({ where: { linkId: link.id, createdAt: { gte: since30 } } }),
      this.prisma.publicScan.findMany({
        where: { linkId: link.id, createdAt: { gte: since14 } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.publicScan.findMany({
        where: { linkId: link.id },
        select: { createdAt: true, referer: true, userAgent: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Série diária últimos 14 dias (YYYY-MM-DD)
    const buckets: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const dt = d(i);
      const key = dt.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    for (const s of scans14) {
      const key = s.createdAt.toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += 1;
    }

    return {
      ok: true,
      link: {
        code: link.code,
        targetPath: link.targetPath,
        createdAt: link.createdAt,
      },
      totals: {
        all: total,
        last7,
        last30,
      },
      series14d: Object.entries(buckets).map(([date, count]) => ({ date, count })),
      last10: last10.map((x) => ({
        at: x.createdAt,
        referer: x.referer ?? null,
        ua: x.userAgent ? String(x.userAgent).slice(0, 120) : null,
      })),
    };
  }

  async getMyMetrics(ownerUserId: string) {
    const link = await this.prisma.publicLink.findFirst({
      where: {
        ownerUserId,
        kind: 'SHOP',
      },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    if (!link?.code) return null;

    // Reusa o método já existente (com checagem de owner)
    return this.getMetrics(link.code, ownerUserId);
  }
}

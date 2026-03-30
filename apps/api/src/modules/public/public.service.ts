// apps/api/src/modules/public/public.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { OrderStatus } from '@prisma/client';
import { resolveUserHome } from '../../common/users/resolve-user-home';
import { resolveProductShippingOptionsFromEntities } from '../logistics/shipping/resolve-product-shipping-options-from-entities';

type PublicEventType = 'PURCHASE' | 'SERVICE' | 'OTHER';

type PublicEvent = {
  id?: string;
  title: string;
  meta: string;
  desc: string;
  verified: boolean;
  type?: PublicEventType;
};

function isPublicPurchaseStatus(
  status: OrderStatus | null | undefined,
): boolean {
  const s = String(status ?? '')
    .toUpperCase()
    .trim();

  return s === 'DELIVERED' || s === 'COMPLETED';
}

function formatDateBR(d: Date | string | null | undefined): string {
  const dt = d instanceof Date ? d : new Date(String(d ?? ''));
  if (Number.isNaN(dt.getTime())) return '—';

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function normalizePublicText(value: unknown): string | null {
  const s = (asText(value) ?? '').trim();
  if (!s) return null;

  const lowered = s.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined') return null;

  return s;
}

const SPECIALTY_LABELS: Record<string, string> = {
  assembly: 'Montagem',
  installation: 'Instalação',
  maintenance: 'Manutenção',
  delivery: 'Entregador',
  technical_visit: 'Visita técnica',
  electrical: 'Elétrica',
  hydraulic: 'Hidráulica',
  carpentry: 'Marcenaria',
  upholstery: 'Estofaria',
};

function specialtyLabelList(values: string[] | null | undefined) {
  const items = Array.isArray(values) ? values : [];
  return items
    .map(
      (item) =>
        SPECIALTY_LABELS[String(item ?? '').trim()] ??
        String(item ?? '').trim(),
    )
    .filter(Boolean);
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductShippingOptions(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        merchantId: true,
        requiresShipping: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
        allowCorreios: true,
        allowTransportadora: true,
        allowLocalDelivery: true,
        allowPickup: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: product.merchantId },
      select: {
        id: true,
        originZipCode: true,
        supportsCorreios: true,
        supportsTransportadora: true,
        supportsLocalDelivery: true,
        supportsPickup: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant do produto não encontrado.');
    }

    return resolveProductShippingOptionsFromEntities({
      product,
      expeditorProfile: merchant,
    });
  }

  async getPublicUserByHandle(handleRaw: string) {
    const handle = String(handleRaw || '')
      .trim()
      .toLowerCase();

    if (!handle) return null;

    const user = await this.prisma.user.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        consumer: { select: { id: true } },
        merchant: { select: { id: true } },
        serviceProvider: { select: { id: true } },
        representative: { select: { id: true } },
        factory: { select: { id: true } },
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) return null;
    const home = resolveUserHome({
      consumer: user.consumer,
      merchant: user.merchant,
      serviceProvider: user.serviceProvider,
      representative: user.representative,
      factory: user.factory,
      roles: user.roles,
    });

    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        kind: true,
        city: true,
        specialties: true,
        address: true,
      },
    });

    const providerReputation = provider
      ? await this.prisma.serviceReview.aggregate({
          where: {
            providerId: provider.id,
          },
          _avg: {
            rating: true,
          },
          _count: {
            _all: true,
          },
        })
      : null;

    const providerUf =
      provider?.address && typeof provider.address === 'object'
        ? (
            asText((provider.address as Record<string, unknown>).uf) ?? ''
          ).trim() || null
        : null;

    const providerSpecialties = specialtyLabelList(provider?.specialties);

    // ✅ MVP: compras viram eventos públicos (sem dados sensíveis)
    const orders = await this.prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        merchantId: true,
      },
    });

    // ✅ opcional: buscar nomes dos merchants (se existirem)
    const merchantIds = Array.from(
      new Set(
        orders
          .map((o) => String(o.merchantId ?? '').trim())
          .filter((v) => v.length > 0),
      ),
    );

    const merchantNameById = new Map<string, string>();

    if (merchantIds.length) {
      const merchants = await this.prisma.merchant.findMany({
        where: { id: { in: merchantIds } },
        select: { id: true, tradeName: true },
      });

      for (const m of merchants) {
        const name = String(m.tradeName ?? '').trim();
        if (name) merchantNameById.set(m.id, name);
      }
    }

    const publicOrders = orders
      .filter((o) => isPublicPurchaseStatus(o.status))
      .slice(0, 6);

    const events: PublicEvent[] = publicOrders.map((o) => {
      const verified = true;

      const merchantName = merchantNameById.get(o.merchantId) ?? '';

      return {
        id: o.id,
        type: 'PURCHASE',
        verified,
        title: 'Compra concluída',
        meta: `Compra • ${formatDateBR(o.createdAt)} • verificado`,
        desc: merchantName
          ? `Registro vinculado a uma compra real em ${merchantName}.`
          : 'Registro vinculado a uma compra real no Marto.',
      };
    });

    const verifiedCount = events.length;

    return {
      ok: true,
      home,
      user: {
        handle: user.handle,
        name: normalizePublicText(user.displayName) ?? user.handle,
        bio: normalizePublicText(user.bio),
        avatarUrl: user.avatarUrl ?? null,
        since: user.createdAt,
      },
      provider: provider
        ? {
            kind: provider.kind,
            city: provider.city ?? null,
            uf: providerUf,
            specialties: Array.isArray(provider.specialties)
              ? provider.specialties
              : [],
            specialtiesLabel: providerSpecialties.length
              ? providerSpecialties.join(' • ')
              : null,
            reputation: {
              averageRating:
                typeof providerReputation?._avg.rating === 'number'
                  ? Number(providerReputation._avg.rating.toFixed(1))
                  : null,
              reviewCount: providerReputation?._count._all ?? 0,
            },
          }
        : null,
      stats: {
        verifiedCount,
        linksCount: 0,
      },
      events,
    };
  }
}

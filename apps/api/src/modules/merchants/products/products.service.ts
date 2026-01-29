import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

function normalizeJson(
  value: Prisma.InputJsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof value === 'undefined') return undefined; // não envia / não altera
  if (value === null) return Prisma.DbNull; // limpa no banco (NULL)
  return value; // valor JSON válido
}

function normalizeImages(
  images: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof images === 'undefined') return undefined;
  if (images === null) return Prisma.DbNull;

  if (Array.isArray(images)) {
    const next = images
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // lista vazia => [] (previsível pro front)
    return next as unknown as Prisma.InputJsonValue;
  }

  // inválido => ignora (não altera)
  return undefined;
}

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
        meta: true,
        createdAt: true,
        updatedAt: true,

        // ✅ traz a loja no retorno (tradeName)
        merchant: {
          select: { id: true, tradeName: true },
        },
      },
    });

    return { ok: true, items };
  }

  async createByUserId(
    userId: string,
    body: {
      title: string;
      description?: string | null;
      priceCents: number;
      images?: unknown; // pode vir string[] | null do front
      meta?: Prisma.InputJsonValue | null;
    },
  ) {
    if (!userId) throw new UnauthorizedException('Sem usuário.');

    const title = String(body?.title ?? '').trim();
    const description =
      body?.description === null || body?.description === undefined
        ? null
        : String(body.description).trim();

    const priceCents = Number(body?.priceCents ?? 0);

    if (!title) return { ok: false, message: 'Título é obrigatório.' };
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      return { ok: false, message: 'priceCents deve ser inteiro > 0.' };
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!merchant) {
      return { ok: false, message: 'Perfil de lojista não encontrado.' };
    }

    const imagesValue = normalizeImages(body.images);
    const metaValue = normalizeJson(body.meta);

    const created = await this.prisma.product.create({
      data: {
        merchantId: merchant.id,
        title,
        description,
        priceCents,
        active: true,
        ...(typeof imagesValue !== 'undefined' ? { images: imagesValue } : {}),
        ...(typeof metaValue !== 'undefined' ? { meta: metaValue } : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        active: true,
        images: true,
        meta: true,
        createdAt: true,
        merchant: { select: { id: true, tradeName: true } },
      },
    });

    return { ok: true, created };
  }

  async updateByUserId(
    userId: string,
    productId: string,
    body: {
      active?: boolean;
      title?: string;
      description?: string | null;
      priceCents?: number;
      images?: unknown; // pode vir string[] | null
      meta?: Prisma.InputJsonValue | null;
    },
  ) {
    if (!userId) throw new UnauthorizedException('Sem usuário.');

    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!merchant) {
      return { ok: false, message: 'Perfil de lojista não encontrado.' };
    }

    const id = String(productId ?? '').trim();
    if (!id) return { ok: false, message: 'productId inválido.' };

    const existing = await this.prisma.product.findFirst({
      where: { id, merchantId: merchant.id },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false, message: 'Produto não encontrado.' };
    }

    const updateData: Prisma.ProductUpdateInput = {};

    if (typeof body.active === 'boolean') {
      updateData.active = body.active;
    }

    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (!t) return { ok: false, message: 'Título não pode ficar vazio.' };
      updateData.title = t;
    }

    if (body.description === null) {
      updateData.description = null;
    } else if (typeof body.description === 'string') {
      updateData.description = body.description.trim() || null;
    }

    if (typeof body.priceCents !== 'undefined') {
      const n = Number(body.priceCents);
      if (!Number.isInteger(n) || n <= 0) {
        return { ok: false, message: 'priceCents deve ser inteiro > 0.' };
      }
      updateData.priceCents = n;
    }

    // ✅ images: aceita string[] ou null; null limpa (DbNull)
    const imagesValue = normalizeImages(body.images);
    if (typeof imagesValue !== 'undefined') {
      updateData.images = imagesValue;
    }

    // ✅ meta: aceita json ou null; null limpa (DbNull)
    const metaValue = normalizeJson(body.meta);
    if (typeof metaValue !== 'undefined') {
      updateData.meta = metaValue;
    }

    if (Object.keys(updateData).length === 0) {
      return { ok: false, message: 'Nenhum campo válido para atualizar.' };
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        active: true,
        images: true,
        meta: true,
        updatedAt: true,
        merchant: { select: { id: true, tradeName: true } },
      },
    });

    return { ok: true, updated };
  }

  async addImageByUserId(userId: string, productId: string, imageUrl: string) {
    if (!userId) throw new UnauthorizedException('Sem usuário.');

    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!merchant) {
      return { ok: false, message: 'Perfil de lojista não encontrado.' };
    }

    const id = String(productId ?? '').trim();
    if (!id) return { ok: false, message: 'productId inválido.' };

    const product = await this.prisma.product.findFirst({
      where: { id, merchantId: merchant.id },
      select: { id: true, images: true },
    });

    if (!product) {
      return { ok: false, message: 'Produto não encontrado.' };
    }

    const url = String(imageUrl ?? '').trim();
    if (!url) return { ok: false, message: 'imageUrl inválida.' };

    const current = Array.isArray(product.images)
      ? (product.images as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    const next = [...current, url];

    const updated = await this.prisma.product.update({
      where: { id },
      data: { images: next as unknown as Prisma.InputJsonValue },
      select: {
        id: true,
        images: true,
        updatedAt: true,
      },
    });

    return { ok: true, updated };
  }
}

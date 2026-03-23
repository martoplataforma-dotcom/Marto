import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { buildProductShippingSetup } from '../../logistics/shipping/build-product-shipping-setup';
import { resolveProductShippingOptionsFromEntities } from '../../logistics/shipping/resolve-product-shipping-options-from-entities';

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

function normalizeCaptions(captions: unknown): string[] | undefined {
  if (typeof captions === 'undefined') return undefined;
  if (captions === null) return [];

  if (Array.isArray(captions)) {
    return captions
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .map((s) => (s.length > 0 ? s : ''));
  }

  return undefined;
}

function normalizeImageInsights(
  v: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof v === 'undefined') return undefined;
  if (v === null) return Prisma.DbNull;

  // se vier string JSON, tenta parse
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return Prisma.DbNull;
    try {
      return JSON.parse(s) as Prisma.InputJsonValue;
    } catch {
      return undefined; // inválido => ignora (não altera)
    }
  }

  // object/array => JSON válido
  if (typeof v === 'object') return v as Prisma.InputJsonValue;

  return undefined;
}

function ensureInsightsAligned(
  imagesValue: unknown,
  insightsValue: unknown,
): { ok: true } | { ok: false; message: string } {
  // se insights não veio, ok
  if (typeof insightsValue === 'undefined') return { ok: true };
  // se insights veio como DbNull (limpar), ok
  if (insightsValue === Prisma.DbNull) return { ok: true };

  // precisa existir imagens (array) para alinhar 1:1
  if (!Array.isArray(imagesValue)) {
    return {
      ok: false,
      message: 'imageInsights enviado, mas images não é um array.',
    };
  }
  if (!Array.isArray(insightsValue)) {
    return {
      ok: false,
      message: 'imageInsights deve ser um array (1 item por imagem).',
    };
  }
  if (insightsValue.length !== imagesValue.length) {
    return {
      ok: false,
      message: 'imageInsights deve ter o mesmo tamanho de images.',
    };
  }
  return { ok: true };
}

const ALLOWED_PRODUCT_SERVICE_TYPES = new Set([
  'assembly',
  'installation',
  'maintenance',
  'delivery',
  'technical_visit',
  'electrical',
  'hydraulic',
  'carpentry',
  'upholstery',
]);

function normalizeProductServices(value: unknown): string[] | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return [];

  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) =>
      String(item ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .filter((item) => ALLOWED_PRODUCT_SERVICE_TYPES.has(item));

  return [...new Set(normalized)];
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getShippingOptionsById(productId: string) {
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

    const merchantProfile = await this.prisma.merchant.findUnique({
      where: {
        id: product.merchantId,
      },
      select: {
        originZipCode: true,
        supportsCorreios: true,
        supportsTransportadora: true,
        supportsLocalDelivery: true,
        supportsPickup: true,
      },
    });

    if (!merchantProfile) {
      throw new NotFoundException(
        'Perfil logístico do lojista não encontrado.',
      );
    }

    return resolveProductShippingOptionsFromEntities({
      product: {
        requiresShipping: product.requiresShipping,
        weightGrams: product.weightGrams,
        lengthCm: product.lengthCm,
        widthCm: product.widthCm,
        heightCm: product.heightCm,
        allowCorreios: product.allowCorreios,
        allowTransportadora: product.allowTransportadora,
        allowLocalDelivery: product.allowLocalDelivery,
        allowPickup: product.allowPickup,
      },
      expeditorProfile: {
        originZipCode: merchantProfile.originZipCode,
        supportsCorreios: merchantProfile.supportsCorreios,
        supportsTransportadora: merchantProfile.supportsTransportadora,
        supportsLocalDelivery: merchantProfile.supportsLocalDelivery,
        supportsPickup: merchantProfile.supportsPickup,
      },
    });
  }

  private buildShippingFields(input: {
    requiresShipping?: boolean | null;
    productType?: string | null;
    weightGrams?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    allowCorreios?: boolean | null;
    allowTransportadora?: boolean | null;
    allowLocalDelivery?: boolean | null;
    allowPickup?: boolean | null;
  }) {
    const requiresShipping = Boolean(input.requiresShipping);

    const setup = buildProductShippingSetup({
      requiresShipping,
      weightGrams: input.weightGrams ?? null,
      lengthCm: input.lengthCm ?? null,
      widthCm: input.widthCm ?? null,
      heightCm: input.heightCm ?? null,
    });

    return {
      requiresShipping,
      productType: input.productType ?? null,
      weightGrams: input.weightGrams ?? null,
      lengthCm: input.lengthCm ?? null,
      widthCm: input.widthCm ?? null,
      heightCm: input.heightCm ?? null,

      allowCorreios:
        input.allowCorreios ?? setup.defaultPermissions.allowCorreios,
      allowTransportadora:
        input.allowTransportadora ??
        setup.defaultPermissions.allowTransportadora,
      allowLocalDelivery:
        input.allowLocalDelivery ?? setup.defaultPermissions.allowLocalDelivery,
      allowPickup: input.allowPickup ?? setup.defaultPermissions.allowPickup,

      shippingAnalysis: setup.analysis,
    };
  }

  private hasShippingFieldsInPayload(input: {
    requiresShipping?: boolean | null;
    productType?: string | null;
    weightGrams?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    allowCorreios?: boolean | null;
    allowTransportadora?: boolean | null;
    allowLocalDelivery?: boolean | null;
    allowPickup?: boolean | null;
  }) {
    return (
      input.requiresShipping !== undefined ||
      input.productType !== undefined ||
      input.weightGrams !== undefined ||
      input.lengthCm !== undefined ||
      input.widthCm !== undefined ||
      input.heightCm !== undefined ||
      input.allowCorreios !== undefined ||
      input.allowTransportadora !== undefined ||
      input.allowLocalDelivery !== undefined ||
      input.allowPickup !== undefined
    );
  }

  private buildPartialShippingUpdate(input: {
    requiresShipping?: boolean | null;
    productType?: string | null;
    weightGrams?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    allowCorreios?: boolean | null;
    allowTransportadora?: boolean | null;
    allowLocalDelivery?: boolean | null;
    allowPickup?: boolean | null;
  }) {
    const data: Record<string, unknown> = {};

    if (input.requiresShipping !== undefined) {
      data.requiresShipping = input.requiresShipping;
    }

    if (input.productType !== undefined) {
      data.productType = input.productType;
    }

    if (input.weightGrams !== undefined) {
      data.weightGrams = input.weightGrams;
    }

    if (input.lengthCm !== undefined) {
      data.lengthCm = input.lengthCm;
    }

    if (input.widthCm !== undefined) {
      data.widthCm = input.widthCm;
    }

    if (input.heightCm !== undefined) {
      data.heightCm = input.heightCm;
    }

    if (input.allowCorreios !== undefined) {
      data.allowCorreios = input.allowCorreios;
    }

    if (input.allowTransportadora !== undefined) {
      data.allowTransportadora = input.allowTransportadora;
    }

    if (input.allowLocalDelivery !== undefined) {
      data.allowLocalDelivery = input.allowLocalDelivery;
    }

    if (input.allowPickup !== undefined) {
      data.allowPickup = input.allowPickup;
    }

    return data;
  }

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
        imageCaptions: true,
        imageInsights: true,
        meta: true,
        createdAt: true,
        updatedAt: true,

        // ✅ traz a loja no retorno (tradeName)
        merchant: {
          select: { id: true, tradeName: true },
        },
        serviceLinks: {
          select: {
            id: true,
            serviceType: true,
            isRequired: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
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
      requiresShipping?: boolean | null;
      productType?: string | null;
      weightGrams?: number | null;
      lengthCm?: number | null;
      widthCm?: number | null;
      heightCm?: number | null;
      allowCorreios?: boolean | null;
      allowTransportadora?: boolean | null;
      allowLocalDelivery?: boolean | null;
      allowPickup?: boolean | null;
      images?: unknown; // pode vir string[] | null do front
      imageCaptions?: unknown; // pode vir string[] | null do front
      imageInsights?: unknown; // pode vir json | null do front
      meta?: Prisma.InputJsonValue | null;
      productServices?: string[] | null;
    },
  ) {
    if (!userId) throw new UnauthorizedException('Sem usuário.');

    const shippingFields = this.buildShippingFields({
      requiresShipping: body.requiresShipping,
      productType: body.productType,
      weightGrams: body.weightGrams,
      lengthCm: body.lengthCm,
      widthCm: body.widthCm,
      heightCm: body.heightCm,
      allowCorreios: body.allowCorreios,
      allowTransportadora: body.allowTransportadora,
      allowLocalDelivery: body.allowLocalDelivery,
      allowPickup: body.allowPickup,
    });

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
    const captionsValue = normalizeCaptions(body.imageCaptions);
    const insightsValue = normalizeImageInsights(body.imageInsights);
    const metaValue = normalizeJson(body.meta);
    const productServices = normalizeProductServices(body.productServices);

    if (
      typeof body.productServices !== 'undefined' &&
      typeof productServices === 'undefined'
    ) {
      return { ok: false, message: 'productServices inválido.' };
    }

    const v = ensureInsightsAligned(imagesValue, insightsValue);
    if (!v.ok) return { ok: false, message: v.message };

    const created = await this.prisma.product.create({
      data: {
        merchantId: merchant.id,
        title,
        description,
        priceCents,
        active: true,
        requiresShipping: shippingFields.requiresShipping,
        productType: shippingFields.productType,
        weightGrams: shippingFields.weightGrams,
        lengthCm: shippingFields.lengthCm,
        widthCm: shippingFields.widthCm,
        heightCm: shippingFields.heightCm,
        allowCorreios: shippingFields.allowCorreios,
        allowTransportadora: shippingFields.allowTransportadora,
        allowLocalDelivery: shippingFields.allowLocalDelivery,
        allowPickup: shippingFields.allowPickup,
        ...(typeof imagesValue !== 'undefined' ? { images: imagesValue } : {}),
        ...(typeof captionsValue !== 'undefined'
          ? { imageCaptions: captionsValue }
          : {}),
        ...(typeof insightsValue !== 'undefined'
          ? { imageInsights: insightsValue }
          : {}),
        ...(typeof metaValue !== 'undefined' ? { meta: metaValue } : {}),
        ...(typeof productServices !== 'undefined'
          ? {
              serviceLinks: {
                create: productServices.map((serviceType, index) => ({
                  serviceType,
                  sortOrder: index,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        active: true,
        images: true,
        imageCaptions: true,
        imageInsights: true,
        meta: true,
        createdAt: true,
        merchant: { select: { id: true, tradeName: true } },
        serviceLinks: {
          select: {
            id: true,
            serviceType: true,
            isRequired: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
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
      requiresShipping?: boolean | null;
      productType?: string | null;
      weightGrams?: number | null;
      lengthCm?: number | null;
      widthCm?: number | null;
      heightCm?: number | null;
      allowCorreios?: boolean | null;
      allowTransportadora?: boolean | null;
      allowLocalDelivery?: boolean | null;
      allowPickup?: boolean | null;
      images?: unknown; // pode vir string[] | null
      imageCaptions?: unknown; // pode vir string[] | null
      imageInsights?: unknown; // pode vir json | null
      meta?: Prisma.InputJsonValue | null;
      productServices?: string[] | null;
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
      select: {
        id: true,
        images: true,
        imageCaptions: true,
        imageInsights: true,
      },
    });

    if (!existing) {
      return { ok: false, message: 'Produto não encontrado.' };
    }

    const updateData: Prisma.ProductUpdateInput = {};
    const productServices = normalizeProductServices(body.productServices);

    if (
      typeof body.productServices !== 'undefined' &&
      typeof productServices === 'undefined'
    ) {
      return { ok: false, message: 'productServices inválido.' };
    }

    const shippingInput = {
      requiresShipping: body.requiresShipping,
      productType: body.productType,
      weightGrams: body.weightGrams,
      lengthCm: body.lengthCm,
      widthCm: body.widthCm,
      heightCm: body.heightCm,
      allowCorreios: body.allowCorreios,
      allowTransportadora: body.allowTransportadora,
      allowLocalDelivery: body.allowLocalDelivery,
      allowPickup: body.allowPickup,
    };

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

    // ✅ Se o front mandou "images", ele pode ter removido/reordenado.
    // Então realinhamos captions/insights seguindo a URL da imagem.
    if (typeof imagesValue !== 'undefined' && Array.isArray(imagesValue)) {
      const prevImages = Array.isArray(existing.images)
        ? (existing.images as unknown[]).filter(
            (x): x is string => typeof x === 'string',
          )
        : [];

      const prevCaptions = Array.isArray(existing.imageCaptions)
        ? (existing.imageCaptions as unknown[]).map((x) =>
            typeof x === 'string' ? x : '',
          )
        : [];

      const prevInsights = Array.isArray(existing.imageInsights)
        ? (existing.imageInsights as unknown[])
        : [];

      const captionByUrl = new Map<string, string>();
      const insightByUrl = new Map<string, unknown>();

      for (let i = 0; i < prevImages.length; i++) {
        const url = prevImages[i];
        captionByUrl.set(url, prevCaptions[i] ?? '');
        insightByUrl.set(
          url,
          prevInsights[i] ?? { overview: [], hotspots: [] },
        );
      }

      const nextImages = (imagesValue as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      );

      const nextCaptions = nextImages.map((url) => captionByUrl.get(url) ?? '');
      const nextInsights = nextImages.map(
        (url) => insightByUrl.get(url) ?? { overview: [], hotspots: [] },
      );

      // Só aplica auto-realign se o front NÃO mandou explicitamente captions/insights.
      if (typeof body.imageCaptions === 'undefined') {
        updateData.imageCaptions = { set: nextCaptions };
      }
      // IMPORTANTE: imageInsights é JSON (não é { set: ... })
      if (typeof body.imageInsights === 'undefined') {
        updateData.imageInsights =
          nextInsights as unknown as Prisma.InputJsonValue;
      }
    }

    const insightsValue = normalizeImageInsights(body.imageInsights);

    const imagesBase =
      typeof imagesValue !== 'undefined' ? imagesValue : existing.images;

    const v = ensureInsightsAligned(imagesBase, insightsValue);
    if (!v.ok) return { ok: false, message: v.message };

    if (typeof insightsValue !== 'undefined') {
      updateData.imageInsights = insightsValue;
    }

    const captionsValue = normalizeCaptions(body.imageCaptions);
    if (typeof captionsValue !== 'undefined') {
      updateData.imageCaptions = { set: captionsValue };
    }

    // ✅ meta: aceita json ou null; null limpa (DbNull)
    const metaValue = normalizeJson(body.meta);
    if (typeof metaValue !== 'undefined') {
      updateData.meta = metaValue;
    }

    if (this.hasShippingFieldsInPayload(shippingInput)) {
      Object.assign(updateData, this.buildPartialShippingUpdate(shippingInput));
    }

    if (Object.keys(updateData).length === 0) {
      if (typeof productServices === 'undefined') {
        return { ok: false, message: 'Nenhum campo válido para atualizar.' };
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (typeof productServices !== 'undefined') {
        await tx.productServiceLink.deleteMany({
          where: { productId: id },
        });

        if (productServices.length > 0) {
          await tx.productServiceLink.createMany({
            data: productServices.map((serviceType, index) => ({
              productId: id,
              serviceType,
              sortOrder: index,
            })),
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          title: true,
          description: true,
          priceCents: true,
          active: true,
          images: true,
          imageCaptions: true,
          imageInsights: true,
          meta: true,
          updatedAt: true,
          merchant: { select: { id: true, tradeName: true } },
          serviceLinks: {
            select: {
              id: true,
              serviceType: true,
              isRequired: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
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
      select: {
        id: true,
        images: true,
        imageCaptions: true,
        imageInsights: true,
      },
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

    const currentCaptions = Array.isArray(product.imageCaptions)
      ? (product.imageCaptions as unknown[]).map((s) =>
          typeof s === 'string' ? s : '',
        )
      : [];

    const captionsNext = [...currentCaptions, ''];

    const currentInsights = Array.isArray(product.imageInsights)
      ? (product.imageInsights as unknown[])
      : [];

    const insightsNext = [...currentInsights, { overview: [], hotspots: [] }];

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        images: next as unknown as Prisma.InputJsonValue,
        imageCaptions: { set: captionsNext },
        imageInsights: insightsNext as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        images: true,
        imageCaptions: true,
        imageInsights: true,
        updatedAt: true,
      },
    });

    return { ok: true, updated };
  }
}

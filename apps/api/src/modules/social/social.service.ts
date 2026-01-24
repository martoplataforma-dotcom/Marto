import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaClient,
  SocialMediaType,
  SocialPostStatus,
} from '@prisma/client';

type CreateSocialPostInput = {
  userId: string;
  orderId: string;
  productId: string;
  caption?: string;
  media: Array<{
    type: 'IMAGE' | 'VIDEO';
    url: string;
    durationSec?: number;
  }>;
};

// ✅ ETAPA 12 (Bronze): limite de posts verificados por dia
const DAILY_VERIFIED_POST_LIMIT = 2;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
function endOfToday(): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
}

@Injectable()
export class SocialService {
  private readonly prisma = new PrismaClient();

  async createPost(input: CreateSocialPostInput) {
    const userId = String(input.userId ?? '').trim();
    const orderId = String(input.orderId ?? '').trim();
    const productId = String(input.productId ?? '').trim();

    if (!userId) throw new BadRequestException('userId é obrigatório');
    if (!orderId) throw new BadRequestException('orderId é obrigatório');
    if (!productId) throw new BadRequestException('productId é obrigatório');

    // ✅ trava Bronze: máx 2 posts/dia por usuário
    const countToday = await this.prisma.socialPost.count({
      where: {
        userId,
        createdAt: {
          gte: startOfToday(),
          lte: endOfToday(),
        },
        deletedAt: null,
        status: SocialPostStatus.ACTIVE,
      },
    });

    if (countToday >= DAILY_VERIFIED_POST_LIMIT) {
      return {
        ok: false,
        message: `Limite diário atingido. No Bronze você pode publicar até ${DAILY_VERIFIED_POST_LIMIT} experiências verificadas por dia.`,
      };
    }

    // ✅ Confere pedido e ownership (no seu schema é userId)
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!order) throw new NotFoundException('Pedido não encontrado');

    if (!order.userId || order.userId !== userId) {
      throw new ForbiddenException(
        'Apenas o dono do pedido pode criar post verificado',
      );
    }

    // ✅ Regra MVP: só permitir post após entrega (pelo status do pedido)
    if (order.status !== 'DELIVERED') {
      throw new ForbiddenException(
        'Pedido ainda não foi entregue (status != DELIVERED)',
      );
    }

    // ✅ Evita duplicar post do mesmo produto no mesmo pedido (MVP)
    const existing = await this.prisma.socialPost.findFirst({
      where: {
        orderId,
        productId,
        status: SocialPostStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (existing) {
      return { ok: true, alreadyExists: true, postId: existing.id };
    }

    const created = await this.prisma.socialPost.create({
      data: {
        userId,
        orderId,
        productId,
        caption: input.caption,
        status: SocialPostStatus.ACTIVE,
        media: {
          create: (input.media ?? []).map((m) => ({
            type:
              m.type === 'VIDEO'
                ? SocialMediaType.VIDEO
                : SocialMediaType.IMAGE,
            url: m.url,
            durationSec: m.durationSec,
          })),
        },
      },
      include: { media: true },
    });

    return { ok: true, post: created };
  }

  async getByOrder(userId: string, orderId: string) {
    const uid = String(userId ?? '').trim();
    const oid = String(orderId ?? '').trim();
    if (!uid) throw new BadRequestException('userId inválido');
    if (!oid) throw new BadRequestException('orderId inválido');

    const order = await this.prisma.order.findUnique({
      where: { id: oid },
      select: { id: true, userId: true },
    });

    if (!order) throw new NotFoundException('Pedido não encontrado');

    if (!order.userId || order.userId !== uid) {
      throw new ForbiddenException('Sem acesso a este pedido');
    }

    const posts = await this.prisma.socialPost.findMany({
      where: {
        orderId: oid,
        status: SocialPostStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: { media: true },
      take: 20,
    });

    return { ok: true, posts };
  }

  async listByProduct(productId: string) {
    const pid = String(productId ?? '').trim();
    if (!pid) throw new BadRequestException('productId inválido');

    const posts = await this.prisma.socialPost.findMany({
      where: {
        productId: pid,
        status: SocialPostStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: { media: true },
      take: 20,
    });

    return { ok: true, posts };
  }

  async deletePost(postId: string, userId: string) {
    const pid = String(postId ?? '').trim();
    const uid = String(userId ?? '').trim();
    if (!pid) throw new BadRequestException('postId inválido');
    if (!uid) throw new BadRequestException('userId inválido');

    const post = await this.prisma.socialPost.findUnique({
      where: { id: pid },
      select: { id: true, userId: true, status: true },
    });

    if (!post) throw new NotFoundException('Post não encontrado');

    if (post.userId !== uid) {
      throw new ForbiddenException('Não permitido');
    }

    if (post.status === SocialPostStatus.DELETED) {
      return { ok: true, post };
    }

    const updated = await this.prisma.socialPost.update({
      where: { id: pid },
      data: {
        status: SocialPostStatus.DELETED,
        deletedAt: new Date(),
      },
    });

    return { ok: true, post: updated };
  }

  async updatePost(postId: string, userId: string, data: { caption?: string }) {
    const pid = String(postId ?? '').trim();
    const uid = String(userId ?? '').trim();
    if (!pid) throw new BadRequestException('postId inválido');
    if (!uid) throw new BadRequestException('userId inválido');

    const post = await this.prisma.socialPost.findUnique({
      where: { id: pid },
      select: {
        id: true,
        userId: true,
        status: true,
        createdAt: true,
      },
    });

    if (!post) throw new NotFoundException('Post não encontrado');

    if (post.userId !== uid) {
      throw new ForbiddenException('Não permitido');
    }

    if (post.status === SocialPostStatus.DELETED) {
      throw new ForbiddenException('Post deletado');
    }

    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();
    const createdAt = post.createdAt.getTime();

    if (now - createdAt > TEN_MINUTES) {
      throw new ForbiddenException('Janela de edição expirou');
    }

    const updated = await this.prisma.socialPost.update({
      where: { id: pid },
      data: {
        caption: data.caption,
      },
    });

    return { ok: true, post: updated };
  }
}

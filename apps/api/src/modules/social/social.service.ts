import { Injectable } from '@nestjs/common';
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

@Injectable()
export class SocialService {
  private readonly prisma = new PrismaClient();

  async createPost(input: CreateSocialPostInput) {
    // Regra de negócio: só permitir post após entrega
    const deliveredShipment = await this.prisma.shipment.findFirst({
      where: {
        orderId: input.orderId,
        status: 'DELIVERED',
      },
      select: { id: true },
    });

    if (!deliveredShipment) {
      throw new Error('Order not delivered yet');
    }

    const created = await this.prisma.socialPost.create({
      data: {
        userId: input.userId,
        orderId: input.orderId,
        productId: input.productId,
        caption: input.caption,
        status: SocialPostStatus.ACTIVE,
        media: {
          create: input.media.map((m) => ({
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

    return created;
  }

  async listByProduct(productId: string) {
    const posts = await this.prisma.socialPost.findMany({
      where: {
        productId,
        status: SocialPostStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: { media: true },
      take: 20,
    });

    return posts;
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
      select: { id: true, userId: true, status: true },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userId !== userId) {
      throw new Error('Not allowed');
    }

    if (post.status === SocialPostStatus.DELETED) {
      return post;
    }

    return this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: SocialPostStatus.DELETED,
        deletedAt: new Date(),
      },
    });
  }

  async updatePost(postId: string, userId: string, data: { caption?: string }) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        status: true,
        createdAt: true,
      },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userId !== userId) {
      throw new Error('Not allowed');
    }

    if (post.status === SocialPostStatus.DELETED) {
      throw new Error('Post deleted');
    }

    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();
    const createdAt = post.createdAt.getTime();

    if (now - createdAt > TEN_MINUTES) {
      throw new Error('Edit window expired');
    }

    return this.prisma.socialPost.update({
      where: { id: postId },
      data: {
        caption: data.caption,
      },
    });
  }
}

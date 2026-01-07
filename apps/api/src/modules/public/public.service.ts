import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicUserByHandle(handleRaw: string) {
    const handle = String(handleRaw || '')
      .trim()
      .toLowerCase();

    if (!handle) return null;

    const user = await this.prisma.user.findUnique({
      where: { handle },
      select: {
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) return null;

    return {
      ok: true,
      user: {
        handle: user.handle,
        name: user.displayName ?? user.handle,
        bio: user.bio ?? null,
        avatarUrl: user.avatarUrl ?? null,
        since: user.createdAt,
      },
      stats: {
        verifiedCount: 0,
        linksCount: 0,
      },
      events: [],
    };
  }
}

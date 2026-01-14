import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

function safeHandle(raw: string) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 32);
}

@Controller('public/users')
export class PublicUsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/public/users/:handle
   * Perfil público por handle
   */
  @Get(':handle')
  async byHandle(@Param('handle') handle: string) {
    const h = safeHandle(handle);
    if (!h) {
      return { ok: false, message: 'Handle inválido.' };
    }

    const user = await this.prisma.user.findUnique({
      where: { handle: h },
      select: {
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return { ok: false, message: 'Usuário não encontrado.' };
    }

    return {
      ok: true,
      user: {
        handle: user.handle,
        name: user.displayName ?? user.handle ?? 'Usuário',
        bio: user.bio ?? null,
        avatarUrl: user.avatarUrl ?? null,
        since: user.createdAt.toISOString(),
      },
      stats: {
        verifiedCount: 0,
        linksCount: 0,
      },
      events: [],
    };
  }
}

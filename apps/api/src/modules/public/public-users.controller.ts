// apps/api/src/modules/public/public-users.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { PublicService } from './public.service';

type PublicEvent = {
  id?: string;
  title: string;
  meta: string;
  desc: string;
  verified: boolean;

  // ✅ contrato novo (frontend já espera)
  type?: 'PURCHASE' | 'SERVICE' | 'OTHER';
};

@Controller('public/users')
export class PublicUsersController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * ✅ GET /api/public/users/:handle
   *
   * Contrato do perfil público:
   * - events: lista de registros públicos (consequência do histórico)
   * - stats: contadores (públicos)
   */
  @Get(':handle')
  async getPublicUser(@Param('handle') handle: string) {
    const raw = await this.publicService.getPublicUserByHandle(handle);

    // ✅ normaliza events
    const events: PublicEvent[] = Array.isArray((raw as any)?.events)
      ? ((raw as any).events as any[]).map((ev) => {
          const verified = Boolean(ev?.verified);

          // ✅ MVP: se o service ainda não mandar type, mantém OTHER.
          // No próximo passo (service), vamos gerar PURCHASE/SERVICE de verdade.
          const type =
            ev?.type === 'PURCHASE' ||
            ev?.type === 'SERVICE' ||
            ev?.type === 'OTHER'
              ? ev.type
              : 'OTHER';

          return {
            id: ev?.id,
            title: String(ev?.title ?? '').trim(),
            meta: String(ev?.meta ?? '').trim(),
            desc: String(ev?.desc ?? '').trim(),
            verified,
            type,
          };
        })
      : [];

    // ✅ stats consistentes
    const verifiedCount =
      typeof (raw as any)?.stats?.verifiedCount === 'number'
        ? (raw as any).stats.verifiedCount
        : events.filter((e) => e.verified).length;

    const linksCount =
      typeof (raw as any)?.stats?.linksCount === 'number'
        ? (raw as any).stats.linksCount
        : 0;

    return {
      ...(raw as any),
      stats: {
        verifiedCount,
        linksCount,
      },
      events,
    };
  }
}

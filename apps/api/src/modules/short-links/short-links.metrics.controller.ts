import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { ShortLinksService } from './short-links.service';

function getUserId(req: Request): string {
  const u = req.user as { id?: string; sub?: string } | undefined;
  return String(u?.id ?? u?.sub ?? '');
}

@Controller('short-links') // com prefixo global => /api/short-links/...
export class ShortLinksMetricsController {
  constructor(private readonly service: ShortLinksService) {}

  @UseGuards(JwtAuthGuard)
  @Get('metrics/:code')
  async metrics(@Param('code') code: string, @Req() req: Request) {
    const userId = getUserId(req);
    const out = await this.service.getMetrics(String(code ?? ''), userId);

    if (out === 'forbidden') return { ok: false, message: 'Sem permissão para ver este link.' };
    if (!out) return { ok: false, message: 'Link não encontrado.' };

    return out;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/metrics')
  async myMetrics(@Req() req: Request) {
    const userId = getUserId(req);
    const out = await this.service.getMyMetrics(userId);

    if (!out) return { ok: false, message: 'Nenhum link principal encontrado para este usuário.' };

    // out já é { ok: true, ... } ou { ok: false, ... } (depende do seu getMetrics)
    return out;
  }
}

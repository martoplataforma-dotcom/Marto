import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ShortLinksService } from './short-links.service';

@Controller('s') // com globalPrefix => /api/s/:code
export class ShortLinksController {
  constructor(private readonly service: ShortLinksService) {}

  @Get(':code')
  async redirect(@Param('code') code: string, @Req() req: Request, @Res() res: Response) {
    const ua = String(req.headers['user-agent'] ?? '');
    const referer = String(req.headers['referer'] ?? req.headers['referrer'] ?? '');
    const ip =
      String((req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? '') ||
      String(req.socket?.remoteAddress ?? '');

    const targetPath = await this.service.resolveAndTrack(code, { userAgent: ua, referer, ip });

    if (!targetPath) return res.status(404).send('Link não encontrado');

    // 302 (temporário) é o padrão para tracking; pode virar 308 depois se quiser.
    return res.redirect(302, targetPath);
  }
}

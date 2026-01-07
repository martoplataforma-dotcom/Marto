import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('representatives')
export class RepresentativesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🔎 GET /api/representatives/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    return this.prisma.representative.findUnique({
      where: { userId },
    });
  }

  /**
   * ✏️ PUT /api/representatives/me
   */
  @UseGuards(JwtAuthGuard)
  @Put('me')
  upsertMe(@Req() req: Request, @Body() body: any) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    const region = String(body?.region ?? '').trim();
    const inviteCode =
      body?.inviteCode === undefined || body?.inviteCode === null
        ? null
        : String(body.inviteCode).trim();

    if (!region) {
      throw new BadRequestException('region obrigatório');
    }

    return this.prisma.representative.upsert({
      where: { userId },
      create: {
        userId,
        region,
        inviteCode,
        status: 'ACTIVE',
      },
      update: {
        region,
        inviteCode,
      },
    });
  }
}

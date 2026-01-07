import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('service-providers')
export class ServiceProvidersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return null;

    return this.prisma.serviceProvider.findUnique({
      where: { userId },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async upsertMe(
    @Req() req: Request,
    @Body()
    body: {
      cpf: string;
      city?: string;
      cepPrefix?: string;
    },
  ) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = user?.id ?? user?.sub;
    if (!userId) return null;

    return this.prisma.serviceProvider.upsert({
      where: { userId },
      create: {
        userId,
        cpf: body.cpf,
        city: body.city ?? null,
        cepPrefix: body.cepPrefix ?? null,
        status: 'ACTIVE',
      },
      update: {
        cpf: body.cpf,
        city: body.city ?? null,
        cepPrefix: body.cepPrefix ?? null,
      },
    });
  }
}

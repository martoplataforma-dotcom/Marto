import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { FactoriesService } from './factories.service';

function getUserId(req: Request): string {
  const u = req.user as { id?: string; sub?: string } | undefined;
  return String(u?.id ?? u?.sub ?? '');
}

type UpsertFactoryBody = {
  tradeName: string;
  legalName?: string | null;
  document: string;
  city?: string | null;
  state?: string | null;
};

@Controller('factories/me')
@UseGuards(JwtAuthGuard)
export class FactoriesController {
  constructor(private readonly service: FactoriesService) {}

  @Get()
  async me(@Req() req: Request) {
    const userId = getUserId(req);
    return this.service.getMe(userId);
  }

  @Put()
  async upsert(@Req() req: Request, @Body() body: UpsertFactoryBody) {
    const userId = getUserId(req);
    return this.service.upsertMe(userId, body);
  }
}

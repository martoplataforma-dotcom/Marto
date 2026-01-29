// apps/api/src/modules/merchants/merchant-orders.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MerchantOrdersService } from './merchant-orders.service';

type AuthedReq = { user?: { id?: string } };

@UseGuards(JwtAuthGuard)
@Controller('merchants/me/orders')
export class MerchantOrdersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly svc: MerchantOrdersService,
  ) {}

  private async resolveMerchantIdFromUser(req: AuthedReq): Promise<string> {
    const userId = String(req.user?.id ?? '').trim();
    if (!userId) throw new BadRequestException('Token inválido (sem userId).');

    const merchant = await this.prisma.merchant.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!merchant?.id) {
      throw new BadRequestException('Usuário não possui loja (merchant).');
    }

    return merchant.id;
  }

  @Get()
  async list(@Req() req: AuthedReq, @Query('take') take?: string) {
    const merchantId = await this.resolveMerchantIdFromUser(req);
    return this.svc.listMyOrders(merchantId, Number(take ?? 20));
  }

  @Get('summary')
  async summary(@Req() req: AuthedReq) {
    const merchantId = await this.resolveMerchantIdFromUser(req);
    return this.svc.summaryMyOrders(merchantId);
  }
}

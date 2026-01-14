// apps/api/src/modules/orders/orders.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrderStatus } from '@prisma/client';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { OrdersService } from './orders.service';

type TransitionStatusBody = {
  toStatus: OrderStatus;
  message?: string;
  meta?: unknown;
};

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body()
    body: {
      merchantId: string;
      city?: string;
      state?: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: string;
      }>;
    },
  ) {
    const u = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(u?.id ?? u?.sub ?? '');

    return this.ordersService.createOrder({
      merchantId: body.merchantId,
      userId, // ✅ sempre do token
      city: body.city,
      state: body.state,
      items: body.items,
    });
  }

  @Get('me')
  myOrders(@Req() req: Request) {
    const u = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(u?.id ?? u?.sub ?? '');
    return this.ordersService.listMyOrders({ userId });
  }

  @Get('sales')
  mySales(@Req() req: Request) {
    const u = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(u?.id ?? u?.sub ?? '');
    return this.ordersService.listMySales({ userId });
  }

  @Post(':orderId/status')
  async setStatus(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() body: TransitionStatusBody,
  ) {
    const u = req.user as { id?: string; sub?: string } | undefined;
    const actorUserId = String(u?.id ?? u?.sub ?? '') || undefined;

    return this.ordersService.transitionStatus({
      orderId,
      toStatus: body.toStatus,
      actorUserId,
      actorRole: 'user',
      message: body.message,
      meta: body.meta,
    });
  }
}

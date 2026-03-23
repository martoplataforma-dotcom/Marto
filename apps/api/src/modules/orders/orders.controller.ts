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
      destinationZipCode?: string;
      selectedShippingMode?:
        | 'CORREIOS'
        | 'TRANSPORTADORA'
        | 'LOCAL_DELIVERY'
        | 'PICKUP';
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
      destinationZipCode: body.destinationZipCode,
      selectedShippingMode: body.selectedShippingMode,
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

  @Get(':orderId/provider-options')
  async getProviderOptions(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ) {
    const u = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(u?.id ?? u?.sub ?? '');

    const result = await this.ordersService.getProviderOptionsForOrder(orderId);
    if (!result) return { ok: false, message: 'Pedido não encontrado' };

    if (String(result.order.userId ?? '') !== userId) {
      return { ok: false, message: 'Forbidden' };
    }

    return {
      ok: true,
      orderId: result.order.id,
      serviceTypes: result.serviceTypes,
      providers: result.providers,
    };
  }

  @Get(':orderId')
  async getOne(@Req() req: Request, @Param('orderId') orderId: string) {
    const u = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(u?.id ?? u?.sub ?? '');

    const order = await this.ordersService.getOrderById(orderId);
    if (!order) return { ok: false, message: 'Pedido não encontrado' };

    // ✅ regra simples: buyer vê o próprio pedido
    if (String((order as any).userId ?? '') === userId) {
      return { ok: true, order };
    }

    // ✅ seller vê pedidos do merchant dele
    const canSellerSee = await this.ordersService.canSellerAccessOrder({
      orderId: (order as any).id,
      actorUserId: userId,
    });

    if (!canSellerSee) return { ok: false, message: 'Forbidden' };

    return { ok: true, order };
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

  @Post(':orderId/pay')
  async payOrder(@Req() req: Request, @Param('orderId') orderId: string) {
    const u = req.user as { id?: string; sub?: string } | undefined;
    const payerUserId = String(u?.id ?? u?.sub ?? '');
    return this.ordersService.payOrderMock(orderId, payerUserId);
  }

  @Post(':id/pay/confirm')
  async confirmOrderPix(@Param('id') id: string) {
    return this.ordersService.confirmOrderPixMock(id);
  }

  @Post(':id/payout/release')
  async releaseOrderPayout(@Param('id') id: string) {
    return this.ordersService.releaseOrderPayoutMock(id);
  }

  @Post(':id/payout/pay')
  async payOrderPayout(@Param('id') id: string) {
    return this.ordersService.payOrderPayoutMock(id);
  }
}

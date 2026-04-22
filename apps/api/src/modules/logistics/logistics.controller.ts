// apps/api/src/modules/logistics/logistics.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ShippingClass } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { findTransporterOptions } from './domain/find-transporter-options';
import { LogisticsService } from './logistics.service';
import type { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import type { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

@Controller('logistics')
export class LogisticsController {
  constructor(
    private readonly service: LogisticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('transporter-options')
  async getTransporterOptions(
    @Query('originZipCode') originZipCode: string,
    @Query('destinationZipCode') destinationZipCode: string,
    @Query('shippingClass') shippingClass: ShippingClass,
    @Query('weightKg') weightKg: string,
  ) {
    const options = await findTransporterOptions({
      prisma: this.prisma,
      originZipCode,
      destinationZipCode,
      shippingClass,
      weightKg: Number(weightKg),
    });

    return {
      ok: true,
      options,
    };
  }

  @Post('shipments')
  createShipment(@Body('orderId') orderId: string) {
    return this.service.createShipment(orderId);
  }

  @Get('shipments/by-order/:orderId')
  getShipmentByOrder(@Param('orderId') orderId: string) {
    return this.service.getShipmentByOrderId(orderId);
  }

  @Get('shipments/:id')
  getShipment(@Param('id') id: string) {
    return this.service.getShipment(id);
  }

  @Patch('shipments/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateShipmentStatusDto) {
    if (
      !dto ||
      typeof (dto as any).status !== 'string' ||
      !(dto as any).status
    ) {
      throw new BadRequestException('status é obrigatório');
    }
    return this.service.updateShipmentStatus(id, dto);
  }

  @Patch('shipments/:id/confirm')
  confirmDelivery(@Param('id') id: string, @Body() dto: ConfirmDeliveryDto) {
    return this.service.confirmDelivery(id, dto.code);
  }

  @Post('shipments/:id/review')
  reviewShipment(
    @Param('id') id: string,
    @Body('rating') ratingRaw: unknown,
    @Body('comment') comment?: string,
  ) {
    const allowed = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'] as const;

    // ✅ aceita: "FIVE" | "5" | 5  (mapeia para enum)
    let rating: (typeof allowed)[number] | null = null;

    if (typeof ratingRaw === 'string') {
      const r = ratingRaw.trim().toUpperCase();

      if ((allowed as readonly string[]).includes(r)) rating = r as any;

      // string numérica
      if (!rating && /^[1-5]$/.test(r)) {
        rating = allowed[Number(r) - 1];
      }
    } else if (typeof ratingRaw === 'number' && Number.isFinite(ratingRaw)) {
      const n = Math.trunc(ratingRaw);
      if (n >= 1 && n <= 5) rating = allowed[n - 1];
    }

    if (!rating) {
      throw new BadRequestException(
        `rating inválido. Use ONE|TWO|THREE|FOUR|FIVE (ou 1..5).`,
      );
    }

    return this.service.reviewShipment(id, rating, comment);
  }
}

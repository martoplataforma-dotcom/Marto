import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import type { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import type { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly service: LogisticsService) {}

  @Post('shipments')
  createShipment(@Body('orderId') orderId: string) {
    return this.service.createShipment(orderId);
  }

  @Get('shipments/:id')
  getShipment(@Param('id') id: string) {
    return this.service.getShipment(id);
  }

  @Patch('shipments/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateShipmentStatusDto) {
    return this.service.updateShipmentStatus(id, dto);
  }

  @Patch('shipments/:id/confirm')
  confirmDelivery(@Param('id') id: string, @Body() dto: ConfirmDeliveryDto) {
    return this.service.confirmDelivery(id, dto.code);
  }

  @Post('shipments/:id/review')
  reviewShipment(
    @Param('id') id: string,
    @Body('rating') rating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE',
    @Body('comment') comment?: string,
  ) {
    return this.service.reviewShipment(id, rating, comment);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  async create(
    @Body()
    body: {
      merchantId: string;
      userId?: string;
      city?: string;
      state?: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: string;
      }>;
    },
  ) {
    return this.orders.createOrder(body);
  }
}

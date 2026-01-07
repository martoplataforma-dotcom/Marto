import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { ProductsService } from './products.service';

@Controller('merchants/me/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /**
   * 🔎 GET /api/merchants/me/products
   * Lista os produtos do lojista logado
   */
  @Get()
  async list(@Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    return this.service.listByUserId(String(userId));
  }

  /**
   * ➕ POST /api/merchants/me/products
   * Cria um produto para o lojista logado
   */
  @Post()
  async create(
    @Req() req: Request,
    @Body()
    body: {
      title: string;
      description?: string | null;
      priceCents: number;
    },
  ) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    return this.service.createByUserId(String(userId), body);
  }
}

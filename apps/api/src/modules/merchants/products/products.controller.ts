import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
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

  /**
   * ✅ PUT /api/merchants/me/products/:id
   * Atualiza um produto do lojista (MVP: active)
   */
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { active?: boolean },
  ) {
    const user = req.user as any;
    const userId = user?.id ?? user?.sub;

    return this.service.updateByUserId(String(userId), String(id), body);
  }
}

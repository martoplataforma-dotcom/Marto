import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { RolesGuard } from '../identity/roles/roles.guard';
import { Roles } from '../identity/roles/roles.decorator';
import { Role } from '../identity/roles/role.enum';

// ✅ merchantId real do seu lojista (Minha Loja)
const MOCK_MERCHANT_ID = 'ec8106f4-58c6-46e5-8826-caf47b3068bf';

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ GET /api/products (catálogo público)
  @Get()
  async list() {
    const items = await this.prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        priceCents: true,
        merchantId: true,
      },
    });

    // manter compatível com seu frontend atual (/shop)
    return items.map((p) => ({
      id: p.id,
      name: p.title,
      price: p.priceCents,
      merchantId: p.merchantId,
    }));
  }

  // ✅ GET /api/products/:id (detalhe público)
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, active: true },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        merchantId: true,
        images: true,
      },
    });

    if (!p) return { ok: false, message: 'Produto não encontrado' };

    return {
      ok: true,
      product: {
        id: p.id,
        name: p.title,
        description: p.description,
        price: p.priceCents,
        merchantId: p.merchantId,
        images: p.images ?? [],
      },
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT)
  @Post()
  async create(@Body() dto: CreateProductDto) {
    // ✅ cria no DB (mantendo merchantId mock por enquanto)
    const created = await this.prisma.product.create({
      data: {
        title: dto.name,
        description: dto.description ?? null,
        priceCents: dto.price,
        active: true,
        merchantId: MOCK_MERCHANT_ID,
        // images: [] // se seu schema tiver default, pode omitir
      },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        merchantId: true,
        createdAt: true,
      },
    });

    // manter compatível com seu frontend atual
    return {
      id: created.id,
      name: created.title,
      price: created.priceCents,
      description: created.description ?? null,
      merchantId: created.merchantId,
      createdAt: created.createdAt.toISOString(),
    };
  }
}

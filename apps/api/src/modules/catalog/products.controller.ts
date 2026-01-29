import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { RolesGuard } from '../identity/roles/roles.guard';
import { Roles } from '../identity/roles/roles.decorator';
import { Role } from '../identity/roles/role.enum';

function normalizeAtHandle(v: unknown): string {
  const s =
    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      ? String(v).trim()
      : '';
  const noAt = s.startsWith('@') ? s.slice(1) : s;
  return noAt.trim().toLowerCase();
}

function extractProductHandleFromDescription(desc: string): string | null {
  const s = String(desc ?? '');

  // aceita variações de espaço/quebra de linha/case
  const re =
    /###\s*Identidade\s*\(Marto\)[\s\S]*?Handle:\s*([a-z0-9-_.]+)[\s\S]*?###\s*\/Identidade\s*\(Marto\)/i;

  const m = s.match(re);
  const handle = m?.[1] ? String(m[1]).trim().toLowerCase() : '';
  return handle ? handle : null;
}

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
        images: true, // ✅ NOVO: inclui imagens na listagem
        merchant: {
          select: {
            id: true,
            tradeName: true,
          },
        },
      },
    });

    // manter compatível com seu frontend atual (/shop)
    return items.map((p) => ({
      id: p.id,
      name: p.title,
      priceCents: p.priceCents,
      price: p.priceCents,
      merchantId: p.merchantId,
      merchant: p.merchant
        ? {
            id: p.merchant.id,
            tradeName: p.merchant.tradeName,
          }
        : null,
      images: p.images ?? [], // ✅ NOVO
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

  @Get('resolve')
  async resolve(
    @Query('merchant') merchantQ: string,
    @Query('product') productQ: string,
  ) {
    const merchantHandle = normalizeAtHandle(merchantQ);
    const productHandle = normalizeAtHandle(productQ);

    if (!merchantHandle || !productHandle) {
      return { ok: false, message: 'Parâmetros inválidos.' };
    }

    // 1) resolve merchant
    const merchant = await this.prisma.merchant.findFirst({
      where: { handle: merchantHandle },
      select: { id: true, handle: true, tradeName: true },
    });

    if (!merchant) {
      return { ok: false, message: 'Loja não encontrada.' };
    }

    // 2) pega produtos do merchant que têm o bloco "Identidade (Marto)"
    const candidates = await this.prisma.product.findMany({
      where: {
        merchantId: merchant.id,
        description: { contains: '### Identidade (Marto)' }, // só pra reduzir universo
      },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        images: true,
        merchantId: true,
        active: true,
      },
      take: 200, // MVP: limita
    });

    // 3) match robusto via regex
    const found = candidates.find((p) => {
      const h = extractProductHandleFromDescription(p.description ?? '');
      return h === productHandle;
    });

    if (!found) {
      return { ok: false, message: 'Produto não encontrado' };
    }

    return {
      ok: true,
      merchant: {
        id: merchant.id,
        handle: merchant.handle,
        tradeName: merchant.tradeName,
      },
      product: found,
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

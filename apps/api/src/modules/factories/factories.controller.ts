import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { FactoriesService } from './factories.service';

function getUserId(req: Request): string {
  const u = req.user as { id?: string; sub?: string } | undefined;
  return String(u?.id ?? u?.sub ?? '');
}

type UpsertFactoryBody = {
  tradeName: string;
  legalName?: string | null;
  document: string;
  city?: string | null;
  state?: string | null;
  originZipCode?: string | null;
  supportsCorreios?: boolean | null;
  supportsTransportadora?: boolean | null;
  supportsLocalDelivery?: boolean | null;
  supportsPickup?: boolean | null;
};

type UpdateFactoryLogisticsBody = {
  originZipCode?: string;
  supportsCorreios?: boolean;
  supportsTransportadora?: boolean;
  supportsLocalDelivery?: boolean;
  supportsPickup?: boolean;
};

@Controller('factories')
export class FactoriesController {
  constructor(private readonly factoriesService: FactoriesService) {}

  // ✅ GET /api/factories/me
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    const userId = getUserId(req);
    return this.factoriesService.getMe(userId);
  }

  // ✅ PUT /api/factories/me
  @UseGuards(JwtAuthGuard)
  @Put('me')
  async upsert(@Req() req: Request, @Body() body: UpsertFactoryBody) {
    const userId = getUserId(req);
    return this.factoriesService.upsertMe(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/logistics')
  async updateMyLogistics(
    @Req() req: Request,
    @Body() body: UpdateFactoryLogisticsBody,
  ) {
    const userId = getUserId(req);
    return this.factoriesService.updateMyLogistics(userId, body);
  }

  // ✅ GET /api/factories/me/overview/summary
  @UseGuards(JwtAuthGuard)
  @Get('me/overview/summary')
  overviewSummary() {
    // aqui no futuro: buscar dados reais por factoryId
    // por enquanto: mock consistente pro frontend
    return {
      ok: true,
      kpis: {
        topSellers: {
          value: 'Top 2',
          hint: 'Mesa Lua • Cadeira Atlas',
          delta: '+12%',
        },
        mostProblems: {
          value: 'Alta',
          hint: 'Rachadura no tampo (lote 24A)',
          delta: '+3 pts',
        },
        reworkRate: {
          value: '2,8%',
          hint: 'Retrabalho por instalação',
          delta: '-0,6%',
        },
        satisfaction: {
          value: '4,6/5',
          hint: 'Pós-serviço (compra → montagem)',
          delta: '+0,2',
        },
      },
      signals: [
        {
          kind: 'QUALIDADE',
          title: 'Aumento de reclamações: rachadura no tampo (lote 24A)',
          meta: 'Impacto: retrabalho • risco: reputação',
          primaryHref: '/dash/factory/quality',
          primaryLabel: 'Abrir qualidade',
          secondaryHref: '/dash/factory/catalog',
          secondaryLabel: 'Ver modelos',
        },
        {
          kind: 'CAMPO',
          title: 'Instalação com atraso em SP — falta de peça em 3 ordens',
          meta: 'Impacto: SLA • ação: revisar embalagem / estoque',
          primaryHref: '/dash/factory/field',
          primaryLabel: 'Abrir campo',
          secondaryHref: '/dash/factory/orders',
          secondaryLabel: 'Ver pedidos',
        },
        {
          kind: 'CANAL',
          title: 'Demanda subiu no RJ — oportunidade de representante local',
          meta: 'Impacto: vendas • ação: abrir região',
          primaryHref: '/dash/factory/regions',
          primaryLabel: 'Abrir regiões',
          secondaryHref: '/dash/factory/representatives',
          secondaryLabel: 'Ver reps',
        },
      ],
    };
  }

  // ✅ GET /api/factories/me/orders/summary
  @UseGuards(JwtAuthGuard)
  @Get('me/orders/summary')
  async meOrdersSummary(@Req() req: Request) {
    const userId = getUserId(req);
    return this.factoriesService.ordersSummaryForMe(String(userId));
  }

  // ✅ GET /api/factories/me/catalog/summary
  @UseGuards(JwtAuthGuard)
  @Get('me/catalog/summary')
  async meCatalogSummary(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.factoriesService.catalogSummaryForMe(String(userId));
  }

  // ✅ GET /api/factories/me/top-products
  @UseGuards(JwtAuthGuard)
  @Get('me/top-products')
  async meTopProducts(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.factoriesService.topProductsForMe(String(userId));
  }
}

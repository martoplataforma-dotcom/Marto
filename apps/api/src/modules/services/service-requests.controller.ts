import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';

type ServiceRequest = {
  id: string;
  orderId: string;
  paymentId: string | null;
  title: string;
  notes: string | null;
  status: 'OPEN' | 'ASSIGNED' | 'DONE';
  createdAt: string;
  finishedByUserId?: string | null;
};

type Review = {
  id: string;
  serviceRequestId: string;
  providerUserId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

@Controller('service-requests')
export class ServiceRequestsController {
  // ✅ store em memória (mock), pra POST e GET baterem
  private static readonly store = new Map<string, ServiceRequest>();

  // store em memória (mock)
  private static readonly reviewsStore: Review[] = [];

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body()
    body: {
      orderId: string;
      paymentId?: string;
      title: string;
      notes?: string;
    },
  ) {
    const sr: ServiceRequest = {
      id: `sr-${Date.now()}`,
      orderId: body.orderId,
      paymentId: body.paymentId ?? null,
      title: body.title,
      notes: body.notes ?? null,
      status: 'ASSIGNED', // você já estava vendo ASSIGNED no provider, mantive
      createdAt: new Date().toISOString(),
    };

    ServiceRequestsController.store.set(sr.id, sr);

    return sr;
  }

  /**
   * 🔎 GET /api/service-requests/:id
   * MVP MOCK: retorna o mesmo objeto criado no POST
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getById(@Param('id') id: string) {
    const sr = ServiceRequestsController.store.get(id);

    if (!sr)
      throw new NotFoundException(`ServiceRequest não encontrado: ${id}`);

    return sr;
  }

  /**
   * ✅ POST /api/service-requests/:id/finish
   * Marca a tarefa como DONE (mock em memória)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/finish')
  finish(@Param('id') id: string, @Req() req: Request) {
    const sr = ServiceRequestsController.store.get(id);

    if (!sr)
      throw new NotFoundException(`ServiceRequest não encontrado: ${id}`);

    const user = req.user as { sub?: string } | undefined;

    sr.status = 'DONE';
    sr.finishedByUserId = user?.sub ?? null;

    ServiceRequestsController.store.set(id, sr);

    return sr;
  }

  /**
   * ⭐ POST /api/reviews
   * MOCK: cria avaliação para uma ServiceRequest DONE
   */
  @UseGuards(JwtAuthGuard)
  @Post('/reviews')
  createReview(
    @Body()
    body: {
      serviceRequestId: string;
      rating: number;
      comment?: string;
    },
  ) {
    const sr = ServiceRequestsController.store.get(body.serviceRequestId);

    if (!sr) {
      throw new NotFoundException('ServiceRequest não encontrada');
    }

    if (sr.status !== 'DONE') {
      throw new BadRequestException('ServiceRequest ainda não foi finalizada');
    }

    if (!sr.finishedByUserId) {
      throw new BadRequestException('Prestador não identificado');
    }

    const review: Review = {
      id: `rev-${Date.now()}`,
      serviceRequestId: sr.id,
      providerUserId: sr.finishedByUserId,
      rating: Math.max(1, Math.min(5, Number(body.rating))),
      comment: body.comment ?? null,
      createdAt: new Date().toISOString(),
    };

    ServiceRequestsController.reviewsStore.push(review);

    return review;
  }
}

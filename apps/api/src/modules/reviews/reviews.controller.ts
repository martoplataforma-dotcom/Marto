import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body()
    body: {
      serviceRequestId: string;
      rating: number;
      comment?: string;
    },
  ) {
    return {
      id: `rev-${Date.now()}`,
      serviceRequestId: body.serviceRequestId,
      rating: body.rating,
      comment: body.comment ?? null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * ⭐ GET /api/reviews
   * MOCK: lista avaliações (em memória simples)
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  listReviews() {
    // Como é mock e não persistimos, vamos simular uma lista simples
    // (em produção isso virá do banco)
    return [
      {
        id: 'rev-demo-1',
        serviceRequestId: 'sr-demo-1',
        rating: 5,
        comment: 'Excelente atendimento',
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

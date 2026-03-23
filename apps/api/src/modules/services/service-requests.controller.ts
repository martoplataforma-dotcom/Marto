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
import { PrismaService } from '../../common/prisma/prisma.service';

type ServiceRequest = {
  id: string;
  orderId: string;
  paymentId: string | null;
  providerId?: string | null;
  serviceType?: string | null;
  linkedProductId?: string | null;
  title: string;
  notes: string | null;
  status:
    | 'OPEN'
    | 'REQUESTED'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'DONE'
    | 'CANCELLED';
  createdAt: string;
  finishedByUserId?: string | null;
};

@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ store em memória (mock), pra POST e GET baterem
  private static readonly store = new Map<string, ServiceRequest>();

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() req: Request,
    @Body()
    body: {
      orderId: string;
      paymentId?: string;
      providerId?: string;
      serviceType?: string;
      linkedProductId?: string;
      title: string;
      notes?: string;
    },
  ) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const orderId = String(body.orderId ?? '').trim();
    const title = String(body.title ?? '').trim();
    const notes = String(body.notes ?? '').trim() || null;
    const paymentId = String(body.paymentId ?? '').trim() || null;
    const providerId = String(body.providerId ?? '').trim() || null;
    const linkedProductId = String(body.linkedProductId ?? '').trim() || null;
    const serviceType =
      String(body.serviceType ?? '').trim().toLowerCase() || null;

    if (!orderId) {
      throw new BadRequestException('orderId é obrigatório.');
    }

    if (!title) {
      throw new BadRequestException('title é obrigatório.');
    }

    if (!serviceType) {
      throw new BadRequestException('serviceType é obrigatório.');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        items: {
          select: {
            productId: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido não encontrado: ${orderId}`);
    }

    if (String(order.userId ?? '') !== userId) {
      throw new BadRequestException(
        'Esse pedido não pertence ao usuário logado.',
      );
    }

    if (linkedProductId) {
      const orderHasProduct = order.items.some(
        (item) => String(item.productId ?? '') === linkedProductId,
      );

      if (!orderHasProduct) {
        throw new BadRequestException(
          'linkedProductId não pertence aos itens deste pedido.',
        );
      }
    }

    if (providerId) {
      const provider = await this.prisma.serviceProvider.findUnique({
        where: { id: providerId },
        select: { id: true, status: true },
      });

      if (!provider) {
        throw new NotFoundException(`Prestador não encontrado: ${providerId}`);
      }

      if (String(provider.status ?? '').toUpperCase() !== 'ACTIVE') {
        throw new BadRequestException('Prestador informado não está ativo.');
      }
    }

    const created = await this.prisma.serviceRequest.create({
      data: {
        orderId,
        userId,
        providerId,
        serviceType,
        linkedProductId,
        title,
        notes,
        status: 'REQUESTED',
      },
      select: {
        id: true,
        orderId: true,
        userId: true,
        providerId: true,
        serviceType: true,
        linkedProductId: true,
        title: true,
        notes: true,
        status: true,
        createdAt: true,
      },
    });

    ServiceRequestsController.store.set(created.id, {
      id: created.id,
      orderId: created.orderId,
      paymentId,
      providerId: created.providerId ?? null,
      serviceType: created.serviceType,
      linkedProductId: created.linkedProductId ?? null,
      title: created.title,
      notes: created.notes ?? null,
      status: 'REQUESTED',
      createdAt: created.createdAt.toISOString(),
      finishedByUserId: null,
    });

    return {
      ...created,
      createdAt: created.createdAt.toISOString(),
    };
  }

  /**
   * 📥 GET /api/service-requests/me
   * Lista solicitações reais recebidas pelo prestador logado
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listMine(@Req() req: Request) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: {
        id: true,
        city: true,
        kind: true,
        specialties: true,
      },
    });

    if (!provider) {
      return {
        ok: true,
        provider: null,
        requests: [],
      };
    }

    const requests = await this.prisma.serviceRequest.findMany({
      where: {
        providerId: provider.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        orderId: true,
        providerId: true,
        serviceType: true,
        linkedProductId: true,
        title: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        order: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    const productIds = Array.from(
      new Set(
        requests
          .map((item) => String(item.linkedProductId ?? '').trim())
          .filter(Boolean),
      ),
    );

    const linkedProducts =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: {
              id: { in: productIds },
            },
            select: {
              id: true,
              title: true,
            },
          })
        : [];

    const productsById = new Map(
      linkedProducts.map((product) => [product.id, product]),
    );

    return {
      ok: true,
      provider: {
        id: provider.id,
        city: provider.city,
        kind: provider.kind,
        specialties: provider.specialties,
      },
      requests: requests.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        providerId: item.providerId,
        serviceType: item.serviceType,
        linkedProductId: item.linkedProductId,
        title: item.title,
        notes: item.notes,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        completedAt: item.completedAt?.toISOString() ?? null,
        order: {
          id: item.order.id,
          createdAt: item.order.createdAt.toISOString(),
        },
        linkedProduct: item.linkedProductId
          ? {
              id: item.linkedProductId,
              title: productsById.get(item.linkedProductId)?.title ?? null,
            }
          : null,
      })),
    };
  }

  /**
   * 📦 GET /api/service-requests/by-order/:orderId
   * Lista solicitações de serviço do pedido para o comprador dono
   */
  @UseGuards(JwtAuthGuard)
  @Get('by-order/:orderId')
  async listByOrder(@Req() req: Request, @Param('orderId') orderId: string) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido não encontrado: ${orderId}`);
    }

    if (String(order.userId ?? '') !== userId) {
      throw new BadRequestException('Esse pedido não pertence ao usuário logado.');
    }

    const requests = await this.prisma.serviceRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        userId: true,
        providerId: true,
        serviceType: true,
        linkedProductId: true,
        title: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        provider: {
          select: {
            id: true,
            city: true,
            kind: true,
            user: {
              select: {
                handle: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        serviceReview: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return {
      ok: true,
      orderId,
      requests: requests.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        userId: item.userId,
        providerId: item.providerId,
        serviceType: item.serviceType,
        linkedProductId: item.linkedProductId,
        title: item.title,
        notes: item.notes,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        completedAt: item.completedAt?.toISOString() ?? null,
        provider: item.provider
          ? {
              id: item.provider.id,
              city: item.provider.city,
              kind: item.provider.kind,
              profile: {
                handle: item.provider.user?.handle ?? null,
                displayName: item.provider.user?.displayName ?? null,
                avatarUrl: item.provider.user?.avatarUrl ?? null,
              },
            }
          : null,
        serviceReview: item.serviceReview
          ? {
              id: item.serviceReview.id,
              rating: item.serviceReview.rating,
              comment: item.serviceReview.comment,
              createdAt: item.serviceReview.createdAt.toISOString(),
              updatedAt: item.serviceReview.updatedAt.toISOString(),
            }
          : null,
      })),
    };
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
   * ✅ POST /api/service-requests/:id/accept
   * Aceita uma solicitação real: REQUESTED -> ASSIGNED
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/accept')
  async accept(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!provider) {
      throw new BadRequestException(
        'Prestador não encontrado para o usuário logado.',
      );
    }

    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`ServiceRequest não encontrada: ${id}`);
    }

    if (String(existing.providerId ?? '') !== provider.id) {
      throw new BadRequestException(
        'Essa solicitação não pertence a este prestador.',
      );
    }

    if (String(existing.status ?? '') !== 'REQUESTED') {
      throw new BadRequestException(
        'Só é possível aceitar solicitações em REQUESTED.',
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
      },
      select: {
        id: true,
        orderId: true,
        userId: true,
        providerId: true,
        serviceType: true,
        linkedProductId: true,
        title: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    const mem = ServiceRequestsController.store.get(id);
    if (mem) {
      ServiceRequestsController.store.set(id, {
        ...mem,
        status: 'ASSIGNED',
      });
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * ❌ POST /api/service-requests/:id/reject
   * Recusa uma solicitação real: REQUESTED -> CANCELLED
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/reject')
  async reject(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!provider) {
      throw new BadRequestException(
        'Prestador não encontrado para o usuário logado.',
      );
    }

    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`ServiceRequest não encontrada: ${id}`);
    }

    if (String(existing.providerId ?? '') !== provider.id) {
      throw new BadRequestException(
        'Essa solicitação não pertence a este prestador.',
      );
    }

    if (String(existing.status ?? '') !== 'REQUESTED') {
      throw new BadRequestException(
        'Só é possível recusar solicitações em REQUESTED.',
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      select: {
        id: true,
        orderId: true,
        userId: true,
        providerId: true,
        serviceType: true,
        linkedProductId: true,
        title: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    const mem = ServiceRequestsController.store.get(id);
    if (mem) {
      ServiceRequestsController.store.set(id, {
        ...mem,
        status: 'OPEN',
      });
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * ▶ POST /api/service-requests/:id/start
   * Inicia uma solicitação real: ASSIGNED -> IN_PROGRESS
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/start')
  async start(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!provider) {
      throw new BadRequestException(
        'Prestador não encontrado para o usuário logado.',
      );
    }

    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`ServiceRequest não encontrada: ${id}`);
    }

    if (String(existing.providerId ?? '') !== provider.id) {
      throw new BadRequestException(
        'Essa solicitação não pertence a este prestador.',
      );
    }

    if (String(existing.status ?? '') !== 'ASSIGNED') {
      throw new BadRequestException(
        'Só é possível iniciar solicitações em ASSIGNED.',
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        orderId: true,
        userId: true,
        providerId: true,
        serviceType: true,
        linkedProductId: true,
        title: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    const mem = ServiceRequestsController.store.get(id);
    if (mem) {
      ServiceRequestsController.store.set(id, {
        ...mem,
        status: 'IN_PROGRESS',
      });
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * ✅ POST /api/service-requests/:id/finish
   * Conclui uma solicitação real: IN_PROGRESS -> COMPLETED
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/finish')
  async finish(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const provider = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!provider) {
      throw new BadRequestException(
        'Prestador não encontrado para o usuário logado.',
      );
    }

    const existing = await this.prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`ServiceRequest não encontrada: ${id}`);
    }

    if (String(existing.providerId ?? '') !== provider.id) {
      throw new BadRequestException(
        'Essa solicitação não pertence a este prestador.',
      );
    }

    if (String(existing.status ?? '') !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Só é possível concluir solicitações em IN_PROGRESS.',
      );
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      select: {
        id: true,
        orderId: true,
        userId: true,
        providerId: true,
        serviceType: true,
        linkedProductId: true,
        title: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    const mem = ServiceRequestsController.store.get(id);
    if (mem) {
      ServiceRequestsController.store.set(id, {
        ...mem,
        status: 'COMPLETED',
        finishedByUserId: userId,
      });
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  async createReview(
    @Req() req: Request,
    @Body()
    body: {
      serviceRequestId: string;
      rating: number;
      comment?: string;
    },
  ) {
    const user = req.user as { id?: string; sub?: string } | undefined;
    const userId = String(user?.id ?? user?.sub ?? '').trim();

    if (!userId) {
      throw new BadRequestException('Usuário inválido.');
    }

    const serviceRequestId = String(body.serviceRequestId ?? '').trim();
    const rating = Number(body.rating);
    const comment = String(body.comment ?? '').trim() || null;

    if (!serviceRequestId) {
      throw new BadRequestException('serviceRequestId é obrigatório.');
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating deve ser um inteiro entre 1 e 5.');
    }

    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: {
        id: true,
        orderId: true,
        userId: true,
        providerId: true,
        status: true,
        serviceReview: {
          select: { id: true },
        },
      },
    });

    if (!serviceRequest) {
      throw new NotFoundException(
        `ServiceRequest não encontrada: ${serviceRequestId}`,
      );
    }

    if (String(serviceRequest.userId ?? '') !== userId) {
      throw new BadRequestException(
        'Essa solicitação não pertence ao usuário logado.',
      );
    }

    if (String(serviceRequest.status ?? '') !== 'COMPLETED') {
      throw new BadRequestException(
        'Só é possível avaliar solicitações em COMPLETED.',
      );
    }

    if (!serviceRequest.providerId) {
      throw new BadRequestException(
        'A solicitação não possui prestador vinculado.',
      );
    }

    if (serviceRequest.serviceReview) {
      throw new BadRequestException('Essa solicitação já foi avaliada.');
    }

    const created = await this.prisma.serviceReview.create({
      data: {
        serviceRequestId,
        orderId: serviceRequest.orderId,
        userId,
        providerId: serviceRequest.providerId,
        rating,
        comment,
      },
      select: {
        id: true,
        serviceRequestId: true,
        orderId: true,
        userId: true,
        providerId: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}

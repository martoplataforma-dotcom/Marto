// apps/api/src/modules/logistics/logistics.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { OrderEventType } from '@prisma/client';

@Injectable()
export class LogisticsService {
  constructor(private readonly prisma: PrismaService) {}

  createShipment(orderId: string) {
    return this.prisma.shipment.create({
      data: { orderId },
    });
  }

  async getShipmentByOrderId(orderId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { orderId },
      include: {
        events: true,
        incidents: true,
        transporter: true,
        review: true,
      },
    });

    return { ok: true, shipment };
  }

  getShipment(id: string) {
    return this.prisma.shipment.findUnique({
      where: { id },
      include: {
        events: true,
        incidents: true,
        transporter: true,
        review: true,
      },
    });
  }

  async updateShipmentStatus(shipmentId: string, dto: UpdateShipmentStatusDto) {
    // ✅ pega o estado anterior + orderId para poder refletir no Order + criar OrderEvent
    const existing = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, status: true, orderId: true },
    });

    if (!existing) throw new NotFoundException('Shipment not found');

    // ✅ atualiza shipment e já retorna status final + orderId
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: dto.status as any },
      select: { id: true, status: true, orderId: true },
    });

    // ✅ evento do shipment (como já era)
    await this.prisma.shipmentEvent.create({
      data: {
        shipmentId,
        status: dto.status as any,
        description: dto.description ?? null,
      },
    });

    // ✅ incidente (como já era)
    if (dto.incidentType) {
      await this.prisma.shipmentIncident.create({
        data: {
          shipmentId,
          type: dto.incidentType as any,
          description: dto.incidentDescription ?? null,
        },
      });
    }

    // ✅ NOVO: se marcou DELIVERED, o pedido acompanha + cria OrderEvent
    if (String(updated.status).toUpperCase() === 'DELIVERED') {
      // ✅ Mudança única: pega o status atual do pedido ANTES de atualizar,
      // para o OrderEvent ter fromStatus correto.
      const currentOrder = await this.prisma.order.findUnique({
        where: { id: updated.orderId },
        select: { status: true },
      });
      const fromStatus = currentOrder?.status ?? null;

      await this.prisma.order.update({
        where: { id: updated.orderId },
        data: { status: 'DELIVERED' as any },
      });

      await this.prisma.orderEvent.create({
        data: {
          orderId: updated.orderId,
          type: OrderEventType.STATUS_CHANGED, // equivalente a 'STATUS_CHANGED'
          fromStatus: fromStatus as any,
          toStatus: 'DELIVERED' as any,
          actorRole: 'TRANSPORTER' as any,
          message: 'Entrega marcada como DELIVERED pela transportadora.',
        },
      });
    }

    return { ok: true, shipmentId: updated.id };
  }

  async confirmDelivery(shipmentId: string, code: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryProof.create({
        data: {
          shipmentId,
          type: 'CODE' as any,
          code,
        },
      });

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: 'DELIVERED' as any },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          status: 'DELIVERED' as any,
          description: 'Entrega confirmada por código',
        },
      });
    });

    return { delivered: true };
  }

  // ✅ MÉTODO ADICIONADO — EXATAMENTE COMO PEDIDO
  async reviewShipment(
    shipmentId: string,
    rating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE',
    comment?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true },
    });

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    if (shipment.status !== 'DELIVERED') {
      throw new Error('Shipment not delivered yet');
    }

    // ✅ upsert: se já existe, atualiza (melhor UX)
    return this.prisma.logisticsReview.upsert({
      where: { shipmentId: shipmentId },
      create: {
        shipmentId: shipmentId,
        rating: rating as any,
        comment,
      },
      update: {
        rating: rating as any,
        comment,
      },
    });
  }
}

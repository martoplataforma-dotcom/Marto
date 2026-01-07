import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

@Injectable()
export class LogisticsService {
  constructor(private readonly prisma: PrismaService) {}

  createShipment(orderId: string) {
    return this.prisma.shipment.create({
      data: { orderId },
    });
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
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true },
    });

    if (!shipment) throw new NotFoundException('Shipment not found');

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: dto.status as any },
    });

    await this.prisma.shipmentEvent.create({
      data: {
        shipmentId,
        status: dto.status as any,
        description: dto.description ?? null,
      },
    });

    if (dto.incidentType) {
      await this.prisma.shipmentIncident.create({
        data: {
          shipmentId,
          type: dto.incidentType as any,
          description: dto.incidentDescription ?? null,
        },
      });
    }

    return { ok: true };
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

    return this.prisma.logisticsReview.create({
      data: {
        shipmentId,
        rating: rating as any,
        comment,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PurchaseIntentStatus } from '@prisma/client';

@Injectable()
export class PurchaseIntentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    channelId: string;
    companyName: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    productInfo: any;
    quantity?: number;
    frequency?: string;
    notes?: string;
  }) {
    const created = await this.prisma.purchaseIntent.create({
      data: {
        channelId: params.channelId,
        companyName: params.companyName,
        contactName: params.contactName,
        contactEmail: params.contactEmail,
        contactPhone: params.contactPhone,
        productInfo: params.productInfo,
        quantity: params.quantity,
        frequency: params.frequency,
        notes: params.notes,
      },
    });

    return created;
  }

  async list(channelId: string) {
    const rows = await this.prisma.purchaseIntent.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
    });

    return rows;
  }

  async getById(id: string) {
    const row = await this.prisma.purchaseIntent.findUnique({
      where: { id },
    });

    return row;
  }

  async updateStatus(id: string, status: PurchaseIntentStatus) {
    const updated = await this.prisma.purchaseIntent.update({
      where: { id },
      data: { status },
    });

    return updated;
  }

  // ✅ ADICIONADO: compatível com o controller atual
  async countIntents() {
    const total = await this.prisma.purchaseIntent.count();
    return total;
  }

  // ✅ ADICIONADO: compatível com o controller atual
  async createIntent(body: {
    channelId: string;
    companyName: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    productInfo: any;
    quantity?: number;
    frequency?: string;
    notes?: string;
  }) {
    // reaproveita a lógica já existente
    const created = await this.create(body);
    return created;
  }
}

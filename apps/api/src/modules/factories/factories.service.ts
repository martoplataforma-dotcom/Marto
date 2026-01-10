import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type UpsertFactoryBody = {
  tradeName: string;
  legalName?: string | null;
  document: string;
  city?: string | null;
  state?: string | null;
};

@Injectable()
export class FactoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    const factory = await this.prisma.factory.findUnique({
      where: { userId },
    });

    return { ok: true, factory };
  }

  async upsertMe(userId: string, body: UpsertFactoryBody) {
    if (!userId) throw new BadRequestException('Usuário inválido.');

    const tradeName = String(body?.tradeName ?? '').trim();
    const document = String(body?.document ?? '')
      .replace(/\D/g, '')
      .trim();

    if (!tradeName) {
      throw new BadRequestException('tradeName é obrigatório.');
    }

    if (!document) {
      throw new BadRequestException('document (CNPJ) é obrigatório.');
    }

    const factory = await this.prisma.factory.upsert({
      where: { userId },
      create: {
        userId,
        tradeName,
        legalName: body.legalName ?? null,
        document,
        city: body.city ?? null,
        state: body.state ?? null,
      },
      update: {
        tradeName,
        legalName: body.legalName ?? null,
        document,
        city: body.city ?? null,
        state: body.state ?? null,
      },
    });

    return { ok: true, factory };
  }
}

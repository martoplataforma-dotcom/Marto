import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ServiceProviderKind } from '@prisma/client';

@Injectable()
export class ServiceProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const sp = await this.prisma.serviceProvider.findUnique({
      where: { userId },
      select: { id: true, userId: true, kind: true, specialties: true },
    });

    return {
      ok: true,
      serviceProvider: sp,
    };
  }

  async updateSpecialties(userId: string, specialtiesRaw: string[]) {
    const specialties = (specialtiesRaw ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean);

    const kind = specialties.includes('delivery')
      ? ServiceProviderKind.DELIVERY
      : ServiceProviderKind.GENERIC;

    const sp = await this.prisma.serviceProvider.upsert({
      where: { userId },
      create: {
        userId,

        // ✅ obrigatórios no seu schema atual
        cpf: '00000000000',
        status: 'ACTIVE',

        kind,
        specialties,
      },
      update: {
        kind,
        specialties,
      },
      select: { id: true, userId: true, kind: true, specialties: true },
    });

    return {
      ok: true,
      serviceProvider: sp,
    };
  }
}

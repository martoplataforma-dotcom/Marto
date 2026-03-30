// apps/api/src/modules/identity/me/me.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { MerchantStatus, RoleCode as PrismaRoleCode } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type AddRoleBody =
  | {
      role: 'CONSUMER';
      consumer?: {
        city?: string;
        cepPrefix?: string;
      };
    }
  | {
      role: 'SERVICE_PROVIDER';
      serviceProvider: {
        cpf: string;
        categories: unknown;
        city?: string;
        cepPrefix?: string;
      };
    }
  | {
      role: 'REPRESENTATIVE';
      representative: {
        region: string;
        inviteCode?: string;
      };
    }
  | {
      role: 'MERCHANT';
      merchant: {
        tradeName: string;
        legalName?: string;
        document: string;
        city?: string;
        cepPrefix?: string;
        payoutTarget?: unknown;
      };
    }
  | {
      role: 'FACTORY';
      factory: {
        tradeName: string;
        legalName?: string;
        document: string;
        city?: string;
        state?: string;
      };
    }
  | {
      role: 'CARRIER';
      carrier: {
        legalName: string;
        document: string;
        regions: unknown;
        cargoTypes: unknown;
        payoutTarget?: unknown;
      };
    };

function normalizeSpecialties(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      String(item ?? '')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
}

function mapActiveRoleToHome(role: PrismaRoleCode | null | undefined): string {
  switch (role) {
    case 'MERCHANT':
      return 'merchant';
    case 'SERVICE_PROVIDER':
      return 'service_provider';
    case 'FACTORY':
      return 'factory';
    case 'REPRESENTATIVE':
      return 'representative';
    case 'CARRIER':
      return 'carrier';
    case 'CONSUMER':
    default:
      return 'consumer';
  }
}

const PROFESSIONAL_ROLES = new Set<PrismaRoleCode>([
  'MERCHANT',
  'SERVICE_PROVIDER',
  'REPRESENTATIVE',
  'FACTORY',
  'CARRIER',
]);

function isProfessionalRole(role: PrismaRoleCode): boolean {
  return PROFESSIONAL_ROLES.has(role);
}

function redirectFromHome(
  home: string | null | undefined,
  opts?: { serviceProviderSpecialties?: unknown },
): string {
  const h = String(home ?? '').trim();

  if (h === 'service_provider') {
    const specialties = normalizeSpecialties(opts?.serviceProviderSpecialties);
    return specialties.length
      ? '/dash/provider/services'
      : '/dash/provider/onboarding/services';
  }

  if (h === 'merchant') return '/dash/merchant';
  if (h === 'factory') return '/dash/factory';
  if (h === 'representative') return '/dash/representative';
  if (h === 'carrier') return '/dash/carrier';

  return '/dash/consumer';
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    if (!userId) throw new BadRequestException('userId inválido');

    let user: {
      id: string;
      handle: string | null;
      displayName: string | null;
      bio: string | null;
      avatarUrl: string | null;
      activeRole: PrismaRoleCode | null;
      consumer: { id: string } | null;
      merchant: { id: string } | null;
      serviceProvider: { id: string } | null;
      representative: { id: string } | null;
      factory: { id: string } | null;
      roles: { role: PrismaRoleCode }[];
    } | null = null;

    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          handle: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          activeRole: true,
          consumer: { select: { id: true } },
          merchant: { select: { id: true } },
          serviceProvider: { select: { id: true } },
          representative: { select: { id: true } },
          factory: { select: { id: true } },
          roles: {
            select: {
              role: true,
            },
          },
        },
      });
    } catch {
      user = null;
    }

    const roles = Array.isArray(user?.roles)
      ? user.roles.map((r) => r.role)
      : [];

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    if (!user.activeRole) {
      throw new ConflictException(
        'Conta inconsistente: activeRole não definido.',
      );
    }

    if (!roles.includes(user.activeRole)) {
      throw new ConflictException(
        `Conta inconsistente: activeRole ${user.activeRole} sem UserRole correspondente.`,
      );
    }

    if (user.activeRole === 'MERCHANT' && !user.merchant) {
      throw new ConflictException(
        'Conta inconsistente: activeRole MERCHANT sem Merchant.',
      );
    }

    if (user.activeRole === 'SERVICE_PROVIDER' && !user.serviceProvider) {
      throw new ConflictException(
        'Conta inconsistente: activeRole SERVICE_PROVIDER sem ServiceProvider.',
      );
    }

    if (user.activeRole === 'FACTORY' && !user.factory) {
      throw new ConflictException(
        'Conta inconsistente: activeRole FACTORY sem Factory.',
      );
    }

    if (user.activeRole === 'REPRESENTATIVE' && !user.representative) {
      throw new ConflictException(
        'Conta inconsistente: activeRole REPRESENTATIVE sem Representative.',
      );
    }

    const finalHome = mapActiveRoleToHome(user.activeRole);

    // ✅ perfil público — não pode derrubar /me
    let profile: {
      handle: string | null;
      displayName: string | null;
      bio: string | null;
      avatarUrl: string | null;
    } | null = null;

    try {
      if (user) {
        profile = {
          handle: user.handle ?? null,
          displayName: user.displayName ?? null,
          bio: user.bio ?? null,
          avatarUrl: user.avatarUrl ?? null,
        };
      }
    } catch {
      profile = null;
    }

    let serviceProviderSpecialties: unknown = null;

    if (user.activeRole === 'SERVICE_PROVIDER') {
      try {
        const sp = await this.prisma.serviceProvider.findUnique({
          where: { userId },
          select: { specialties: true } as any,
        });

        serviceProviderSpecialties = (sp as any)?.specialties ?? null;
      } catch {
        serviceProviderSpecialties = null;
      }
    }

    const redirectTo = redirectFromHome(finalHome, {
      serviceProviderSpecialties,
    });

    return {
      user: {
        id: userId,
        name: null,
        email: null,
        phone: null,
        status: 'ACTIVE',
      },
      profile,
      roles: roles.map((r) => ({ role: r })),
      onboarding: {
        CONSUMER: roles.includes('CONSUMER'),
        SERVICE_PROVIDER: roles.includes('SERVICE_PROVIDER'),
        REPRESENTATIVE: roles.includes('REPRESENTATIVE'),
        MERCHANT: roles.includes('MERCHANT'),
        FACTORY: roles.includes('FACTORY'),
        CARRIER: roles.includes('CARRIER'),
      },
      home: finalHome,
      activeRole: user.activeRole,
      redirectTo,
      needsRoleChoice: roles.length === 0,
    };
  }

  async addRole(userId: string, body: AddRoleBody) {
    // 🔎 DEBUG — NÃO REMOVE
    console.log('ADD ROLE BODY =>', body);

    if (!userId) throw new BadRequestException('userId inválido');

    const roleStr = String((body as any)?.role || '')
      .trim()
      .toUpperCase();

    if (!roleStr) throw new BadRequestException('role é obrigatório');

    const validRoles = new Set<string>([
      'CONSUMER',
      'SERVICE_PROVIDER',
      'MERCHANT',
      'CARRIER',
      'FACTORY',
      'REPRESENTATIVE',
      'ADMIN',
    ]);

    if (!validRoles.has(roleStr)) {
      throw new BadRequestException(`role inválida: ${roleStr}`);
    }

    const role = roleStr as PrismaRoleCode;

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roles: {
          select: {
            role: true,
          },
        },
        merchant: { select: { id: true } },
        serviceProvider: { select: { id: true } },
        representative: { select: { id: true } },
        factory: { select: { id: true } },
      },
    });

    if (!current) {
      throw new BadRequestException('Usuário não encontrado');
    }

    const currentRoles = current.roles.map((item) => item.role);

    const currentProfessionalRole =
      currentRoles.find((item) => isProfessionalRole(item)) ??
      (current.merchant
        ? 'MERCHANT'
        : current.serviceProvider
          ? 'SERVICE_PROVIDER'
          : current.factory
            ? 'FACTORY'
            : current.representative
              ? 'REPRESENTATIVE'
              : null);

    if (
      isProfessionalRole(role) &&
      currentProfessionalRole &&
      currentProfessionalRole !== role
    ) {
      throw new ConflictException(
        `Usuário já possui papel profissional ${currentProfessionalRole} e não pode receber ${role}.`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.userRole.upsert({
        where: {
          userId_role: {
            userId,
            role,
          },
        },
        create: {
          userId,
          role,
        },
        update: {},
      });

      if (role === 'MERCHANT') {
        const merchant = (body as any).merchant;
        if (!merchant) throw new BadRequestException('merchant é obrigatório');

        const tradeName = String(merchant.tradeName ?? '').trim();
        const document = String(merchant.document ?? '').trim();

        if (!tradeName) {
          throw new BadRequestException('merchant.tradeName é obrigatório');
        }
        if (!document) {
          throw new BadRequestException('merchant.document é obrigatório');
        }

        await tx.merchant.upsert({
          where: { userId },
          create: {
            userId,
            tradeName,
            document,
            status: MerchantStatus.ACTIVE,
          },
          update: {
            tradeName,
            document,
          },
        });
      }

      if (role === 'SERVICE_PROVIDER') {
        const sp = (body as any).serviceProvider;
        if (!sp) {
          throw new BadRequestException('serviceProvider é obrigatório');
        }

        const cpf = String(sp.cpf ?? '').trim();
        if (!cpf) {
          throw new BadRequestException('serviceProvider.cpf é obrigatório');
        }

        const city =
          sp.city !== undefined ? String(sp.city).trim() || null : null;

        const cepPrefix =
          sp.cepPrefix !== undefined
            ? String(sp.cepPrefix).trim() || null
            : null;

        await tx.serviceProvider.upsert({
          where: { userId },
          create: {
            userId,
            cpf,
            city,
            cepPrefix,
            status: 'ACTIVE',
          },
          update: {
            cpf,
            city,
            cepPrefix,
          },
        });
      }

      if (role === 'CONSUMER') {
        const consumer = (body as any)?.consumer ?? {};

        const city =
          consumer?.city !== undefined
            ? String(consumer.city).trim() || null
            : null;

        const cepPrefix =
          consumer?.cepPrefix !== undefined
            ? String(consumer.cepPrefix).trim() || null
            : null;

        await tx.consumer.upsert({
          where: { userId },
          create: {
            userId,
            city,
            cepPrefix,
            status: 'ACTIVE',
          },
          update: {
            city,
            cepPrefix,
          },
        });
      }

      if (role === 'REPRESENTATIVE') {
        const rep = (body as any).representative;
        if (!rep) throw new BadRequestException('representative é obrigatório');

        const region = String(rep.region ?? '').trim();
        if (!region) {
          throw new BadRequestException('representative.region é obrigatório');
        }

        const inviteCode =
          rep.inviteCode !== undefined
            ? String(rep.inviteCode).trim() || null
            : null;

        await tx.representative.upsert({
          where: { userId },
          create: {
            userId,
            region,
            inviteCode,
            status: 'ACTIVE',
          } as any,
          update: {
            region,
            inviteCode,
          } as any,
        });
      }

      if (role === 'FACTORY') {
        const f = (body as any).factory;
        if (!f) throw new BadRequestException('factory é obrigatório');

        const tradeName = String(f?.tradeName ?? '').trim();
        const document = String(f?.document ?? '')
          .replace(/\D/g, '')
          .trim();

        if (!tradeName) {
          throw new BadRequestException('factory.tradeName é obrigatório.');
        }

        if (!document) {
          throw new BadRequestException(
            'factory.document (CNPJ) é obrigatório.',
          );
        }

        await tx.factory.upsert({
          where: { userId },
          create: {
            userId,
            tradeName,
            legalName: f.legalName ?? null,
            document,
            city: f.city ?? null,
            state: f.state ?? null,
          },
          update: {
            tradeName,
            legalName: f.legalName ?? null,
            document,
            city: f.city ?? null,
            state: f.state ?? null,
          },
        });
      }

      if (role === 'CARRIER') {
        const carrier = (body as any).carrier;
        if (!carrier) throw new BadRequestException('carrier é obrigatório');

        const legalName = String(carrier.legalName ?? '').trim();
        const document = String(carrier.document ?? '').trim();

        if (!legalName) {
          throw new BadRequestException('carrier.legalName é obrigatório');
        }

        if (!document) {
          throw new BadRequestException('carrier.document é obrigatório');
        }

        await (tx as any).carrier.upsert({
          where: { userId },
          create: {
            userId,
            legalName,
            document,
            regions: carrier.regions ?? [],
            cargoTypes: carrier.cargoTypes ?? [],
            payoutTarget: carrier.payoutTarget ?? null,
            status: 'ACTIVE',
          },
          update: {
            legalName,
            document,
            regions: carrier.regions ?? [],
            cargoTypes: carrier.cargoTypes ?? [],
            payoutTarget: carrier.payoutTarget ?? null,
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { activeRole: role },
      });

      return {
        ok: true,
        created: { role },
        activeRolePersisted: role,
      };
    });
  }

  // ✅ atualizar perfil do usuário logado
  async updateMyProfile(
    userId: string,
    body: { displayName?: string; bio?: string; avatarUrl?: string },
  ) {
    if (!userId) throw new BadRequestException('userId inválido');

    const displayName =
      body.displayName !== undefined
        ? String(body.displayName).trim() || null
        : undefined;

    const bio =
      body.bio !== undefined ? String(body.bio).trim() || null : undefined;

    const avatarUrl =
      body.avatarUrl !== undefined
        ? String(body.avatarUrl).trim() || null
        : undefined;

    // ✅ 1) Leia e normalize o handle (logo depois de avatarUrl)
    const handle =
      (body as any).handle !== undefined
        ? String((body as any).handle)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9._-]/g, '')
            .slice(0, 24) || null
        : undefined;

    // ✅ 2) Se o handle já existir em outro usuário, bloquear
    if (handle !== undefined && handle !== null) {
      const taken = await this.prisma.user.findFirst({
        where: { handle, NOT: { id: userId } },
        select: { id: true },
      });

      if (taken) {
        throw new BadRequestException('Esse @handle já está em uso.');
      }
    }

    const res = await this.prisma.user.updateMany({
      where: { id: userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(handle !== undefined ? { handle } : {}),
      },
    });

    if (res.count === 0) {
      return { ok: false, reason: 'USER_NOT_FOUND' };
    }

    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    return { ok: true, profile };
  }
}

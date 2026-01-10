// apps/api/src/modules/identity/me/me.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    if (!userId) throw new BadRequestException('userId inválido');

    // ✅ roles persistidas — não pode derrubar /me
    let roles: PrismaRoleCode[] = [];
    try {
      const rows = await this.prisma.userRole.findMany({
        where: { userId },
        select: { role: true },
        orderBy: { createdAt: 'asc' },
      });

      roles = rows.map((r) => r.role);
    } catch {
      roles = [];
    }

    // ✅ home persistido — não pode derrubar /me
    let homeFromDb: string | null = null;
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, home: true } as any,
      });

      homeFromDb = (u as any)?.home ?? null;
    } catch {
      homeFromDb = null;
    }

    // ✅ regra local de home baseada nas roles (FACTORY primeiro)
    let home = 'consumer';

    if (roles.includes('FACTORY')) home = 'factory';
    else if (roles.includes('MERCHANT')) home = 'merchant';
    else if (roles.includes('SERVICE_PROVIDER')) home = 'service_provider';
    else if (roles.includes('REPRESENTATIVE')) home = 'representative';

    const computedHome = home;

    const finalHome = homeFromDb ?? computedHome;

    // ✅ perfil público — não pode derrubar /me
    let profile: {
      handle: string | null;
      displayName: string | null;
      bio: string | null;
      avatarUrl: string | null;
    } | null = null;

    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          handle: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
        },
      });

      if (u) {
        profile = {
          handle: u.handle ?? null,
          displayName: u.displayName ?? null,
          bio: u.bio ?? null,
          avatarUrl: u.avatarUrl ?? null,
        };
      }
    } catch {
      profile = null;
    }

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
      needsRoleChoice: roles.length === 0 && !homeFromDb,
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

    // ✅ NOVO BLOCO — FACTORY (pedido)
    if (body.role === 'FACTORY') {
      const f = body.factory;

      const tradeName = String(f?.tradeName ?? '').trim();
      const document = String(f?.document ?? '')
        .replace(/\D/g, '')
        .trim();

      if (!tradeName) {
        throw new BadRequestException('factory.tradeName é obrigatório.');
      }

      if (!document) {
        throw new BadRequestException('factory.document (CNPJ) é obrigatório.');
      }

      await this.prisma.userRole.create({
        data: {
          userId,
          role: 'FACTORY',
        },
      });

      await this.prisma.factory.upsert({
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

      return { ok: true, created: { role: 'FACTORY' } };
    }

    const role = roleStr as PrismaRoleCode;

    await this.prisma.userRole.upsert({
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

    const home =
      role === 'MERCHANT'
        ? 'merchant'
        : role === 'SERVICE_PROVIDER'
          ? 'service_provider'
          : role === 'REPRESENTATIVE'
            ? 'representative'
            : role === 'FACTORY'
              ? 'factory'
              : role === 'CARRIER'
                ? 'carrier'
                : 'consumer';

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { home } as any,
      });
    } catch {
      /* MVP: se campo home não existir ou update falhar, não derruba */
    }

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

      await this.prisma.merchant.upsert({
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
      if (!sp) throw new BadRequestException('serviceProvider é obrigatório');

      const cpf = String(sp.cpf ?? '').trim();
      if (!cpf) {
        throw new BadRequestException('serviceProvider.cpf é obrigatório');
      }

      const city =
        sp.city !== undefined ? String(sp.city).trim() || null : null;

      const cepPrefix =
        sp.cepPrefix !== undefined ? String(sp.cepPrefix).trim() || null : null;

      await this.prisma.serviceProvider.upsert({
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

      await this.prisma.consumer.upsert({
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

      await this.prisma.representative.upsert({
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

    return { ok: true, created: { role }, homePersisted: home };
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

    const res = await this.prisma.user.updateMany({
      where: { id: userId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
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

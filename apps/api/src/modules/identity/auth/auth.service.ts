// apps/api/src/modules/identity/auth/auth.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private normalizeEmail(email: string): string {
    const normalizedEmail = String(email ?? '')
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      throw new UnauthorizedException('Email inválido.');
    }

    return normalizedEmail;
  }

  private async signAccessToken(
    user: { id: string; email: string },
    roles: string[],
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: 60 * 60 * 24 * 7, // 7 dias
    });

    return { accessToken };
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);

    if (!password || password.length < 6) {
      throw new UnauthorizedException('Senha inválida (mínimo 6 caracteres).');
    }

    const exists = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException('Email já cadastrado.');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
      select: { id: true, email: true },
    });

    return this.signAccessToken(user, ['USER']);
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        roles: { select: { role: true } }, // ✅ pega UserRole
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const ok = await bcrypt.compare(password ?? '', user.passwordHash);

    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const roles = (user.roles ?? []).map((r) => String(r.role)).filter(Boolean);

    return this.signAccessToken(
      { id: user.id, email: user.email },
      roles.length ? roles : ['USER'],
    );
  }

  async refresh(refreshToken: string) {
    // ✅ ainda mock, mas agora GARANTE um User real
    const normalizedEmail = this.normalizeEmail('mock@marto.com');

    // senha mock só pra preencher o campo obrigatório (não será usada no login real)
    const passwordHash = await bcrypt.hash('mock-password', 10);

    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        passwordHash,
      },
      update: {},
      select: { id: true, email: true },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      roles: ['USER'],
      refreshTokenHint: String(refreshToken ?? '').slice(0, 8),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: 60 * 60 * 24 * 7,
    });

    return { accessToken };
  }

  async loginMerchant(email: string) {
    // ✅ mock pra RBAC, mas agora GARANTE user real e usa id real no token
    const normalizedEmail = this.normalizeEmail(email);

    // senha mock só pra preencher o campo obrigatório
    const passwordHash = await bcrypt.hash('mock-password', 10);

    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        passwordHash,
      },
      update: {},
      select: { id: true, email: true },
    });

    return this.signAccessToken(user, ['MERCHANT']);
  }

  /**
   * POST /auth/forgot-password
   * - Sempre retorna { ok: true } (não vaza se email existe)
   * - Gera token, salva apenas hash no banco, expira em 30 min
   * - DEV: imprime link no console (depois troca por email real)
   */
  async forgotPassword(emailRaw: string) {
    const email = this.normalizeEmail(emailRaw);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // ⚠️ resposta neutra (não revela se o email existe)
    if (!user) return { ok: true };

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // DEV: imprime o link no console
    const link = `http://localhost:3000/reset-password?token=${token}`;
    console.log('[RESET PASSWORD]', user.email);
    console.log('[RESET PASSWORD] LINK:', link);

    return { ok: true };
  }

  /**
   * POST /auth/reset-password
   * - Valida token (hash), expiração e se já foi usado
   * - Atualiza passwordHash
   * - Marca usedAt
   */
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(String(token ?? '').trim());

    const row = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!row) {
      throw new ForbiddenException('Token inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(String(newPassword ?? ''), 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }
}

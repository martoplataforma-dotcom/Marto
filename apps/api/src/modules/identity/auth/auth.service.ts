import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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

  private async signAccessToken(user: { id: string; email: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: ['USER'],
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: 60 * 60 * 24 * 7, // 7 dias
    });

    return { accessToken };
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

    return this.signAccessToken(user);
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const ok = await bcrypt.compare(password ?? '', user.passwordHash);

    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.signAccessToken({ id: user.id, email: user.email });
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

    const payload = {
      sub: user.id,
      email: user.email,
      roles: ['MERCHANT'],
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      expiresIn: 60 * 60 * 24 * 7,
    });

    return { accessToken };
  }
}

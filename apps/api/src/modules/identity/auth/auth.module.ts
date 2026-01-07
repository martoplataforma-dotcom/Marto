// apps/api/src/modules/identity/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

// ✅ controller REAL (DB)
import { MeController as MeControllerDb } from '../me/me.controller';

// ✅ service REAL (DB)
import { MeService } from '../me/me.service';

// ✅ PrismaService (dep do MeService)
import { PrismaService } from '../../../common/prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: 15 * 60 },
    }),
  ],
  controllers: [AuthController, MeControllerDb],
  providers: [AuthService, JwtStrategy, MeService, PrismaService],
})
export class AuthModule {}

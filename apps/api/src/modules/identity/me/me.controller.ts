// apps/api/src/modules/identity/me.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MeService } from './me.service';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

type AddRoleBody =
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
        legalName: string;
        cnpj: string;
        categories: unknown;
        city?: string;
        commercialContact?: string;
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

function safeFilename(originalname: string) {
  const ext = extname(originalname || '').toLowerCase();
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  return allowed.has(ext) ? ext : '';
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  private getUserId(req: Request): string {
    const u = req.user as any;
    return String(u?.sub ?? u?.userId ?? u?.id ?? '').trim();
  }

  // ✅ GET /me
  @Get()
  async getMe(@Req() req: Request) {
    const userId = this.getUserId(req);
    return await this.meService.getMe(userId);
  }

  // ✅ POST /me/roles (endpoint legado)
  @Post('roles')
  async addRoleLegacy(@Req() req: Request, @Body() body: AddRoleBody) {
    console.log('[ME] POST /me/roles');
    console.log('[ME] body=', body);

    const userId = this.getUserId(req);
    return await this.meService.addRole(userId, body as any);
  }

  // ✅ POST /me/add-role (endpoint garantido)
  @Post('add-role')
  async addRole(@Req() req: Request, @Body() body: AddRoleBody) {
    const userId = this.getUserId(req);
    return await this.meService.addRole(userId, body as any);
  }

  // ✅ PUT /me/profile
  @Put('profile')
  updateProfile(
    @Req() req: Request,
    @Body()
    body: {
      handle?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
    },
  ) {
    const userId = this.getUserId(req);
    return this.meService.updateMyProfile(userId, body);
  }

  // ✅ POST /me/avatar (upload + grava no profile)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const ok = !!safeFilename(file.originalname);
        cb(ok ? null : new Error('Tipo de arquivo inválido'), ok);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = 'uploads/avatars';
          ensureDir(dir);
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = safeFilename(file.originalname);
          if (!ext) return cb(new Error('Tipo de arquivo inválido'), '');

          const userId = String(
            (req as any)?.user?.sub ??
              (req as any)?.user?.userId ??
              (req as any)?.user?.id ??
              '',
          ).trim();

          if (!userId) return cb(new Error('userId ausente no token'), '');

          const stamp = Date.now();
          cb(null, `u_${userId}_${stamp}${ext}`);
        },
      }),
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file?.filename) throw new BadRequestException('Arquivo não enviado.');

    const userId = this.getUserId(req as Request);
    if (!userId) throw new BadRequestException('userId ausente no token.');

    // ✅ URL acessível pelo browser (você já serve /uploads no main.ts)
    const url = `${req.protocol}://${req.get('host')}/uploads/avatars/${file.filename}`;

    // ✅ grava no profile via MeService (mantém o controller limpo)
    await this.meService.updateMyProfile(userId, { avatarUrl: url });

    return { ok: true, avatarUrl: url };
  }

  // ✅ DELETE /me/avatar (remove foto do perfil)
  @Delete('avatar')
  async removeAvatar(@Req() req: Request) {
    const userId = this.getUserId(req);
    if (!userId) throw new BadRequestException('userId ausente no token.');

    // Se seu avatarUrl não aceitar null, troque por: { avatarUrl: '' }
    await this.meService.updateMyProfile(userId, { avatarUrl: null as any });

    return { ok: true };
  }
}

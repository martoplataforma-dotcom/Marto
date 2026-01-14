import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MeService } from './me.service';

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

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  // ✅ GET /me
  @Get()
  async getMe(@Req() req: Request) {
    const userId =
      (req.user as any).sub ?? (req.user as any).userId ?? (req.user as any).id;

    return await this.meService.getMe(userId);
  }

  // ✅ POST /me/roles (endpoint legado)
  @Post('roles')
  async addRoleLegacy(@Req() req: Request, @Body() body: AddRoleBody) {
    console.log('[ME] POST /me/roles');
    console.log('[ME] body=', body);

    const userId =
      (req.user as any).sub ?? (req.user as any).userId ?? (req.user as any).id;

    return await this.meService.addRole(userId, body as any);
  }

  // ✅ POST /me/add-role (endpoint garantido)
  @Post('add-role')
  async addRole(@Req() req: Request, @Body() body: AddRoleBody) {
    const userId =
      (req.user as any).sub ?? (req.user as any).userId ?? (req.user as any).id;

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
    const userId =
      (req.user as any).sub ?? (req.user as any).userId ?? (req.user as any).id;

    return this.meService.updateMyProfile(userId, body);
  }
}

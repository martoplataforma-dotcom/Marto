// apps/api/src/modules/social/social.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { SocialService } from './social.service';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';

function getUserId(req: Request): string {
  const u = (req as any).user as
    | { userId?: string; sub?: string; id?: string }
    | undefined;

  const id = u?.userId ?? u?.sub ?? u?.id;
  if (!id) throw new Error('userId ausente no token');
  return String(id);
}

// ✅ helper: valida mimetype permitido (imagens + vídeos MVP)
function assertAllowedMime(mime: string | undefined) {
  const m = String(mime ?? '').toLowerCase();

  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime', // mov
  ];

  if (!allowed.includes(m)) {
    throw new Error(`Tipo de arquivo não permitido: ${m || '(vazio)'}`);
  }
}

type CreateSocialPostBody = {
  orderId: string;
  productId: string;
  caption?: string;
  media: Array<{
    type: 'IMAGE' | 'VIDEO';
    url: string;
    durationSec?: number;
  }>;
};

@Controller('social')
export class SocialController {
  constructor(private readonly service: SocialService) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = 'uploads/social';
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const safeExt =
            extname(file.originalname || '').toLowerCase() || '.jpg';
          const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          cb(null, `social-${id}${safeExt}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8MB MVP
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.filename) {
      return { ok: false, message: 'Arquivo não recebido (campo: file).' };
    }

    // ✅ valida tipo antes de retornar URL (MVP)
    try {
      assertAllowedMime(file.mimetype);
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error ? e.message : 'Tipo de arquivo não permitido',
      };
    }

    // ✅ URL pública do arquivo (servido como /uploads/...)
    const url = `/uploads/social/${file.filename}`;
    return { ok: true, url };
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  createPost(
    @Req() req: Request,
    @Body() body: CreateSocialPostBody,
  ): Promise<unknown> {
    const userId = getUserId(req);
    return this.service.createPost({
      userId,
      orderId: body.orderId,
      productId: body.productId,
      caption: body.caption,
      media: body.media ?? [],
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('posts/by-order/:orderId')
  getByOrder(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ): Promise<unknown> {
    const userId = getUserId(req);
    return this.service.getByOrder(userId, String(orderId));
  }

  // ✅ ALIAS (pra compatibilidade com telas antigas)
  @Get('posts/by-product/:productId')
  listByProductAlias(@Param('productId') productId: string): Promise<unknown> {
    return this.service.listByProduct(productId);
  }

  @Get('products/:productId/posts')
  listByProduct(@Param('productId') productId: string): Promise<unknown> {
    return this.service.listByProduct(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/delete')
  deletePost(
    @Req() req: Request,
    @Param('postId') postId: string,
  ): Promise<unknown> {
    const userId = getUserId(req);
    return this.service.deletePost(postId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/update')
  updatePost(
    @Req() req: Request,
    @Param('postId') postId: string,
    @Body() body: { caption?: string },
  ): Promise<unknown> {
    const userId = getUserId(req);
    return this.service.updatePost(postId, userId, {
      caption: body.caption,
    });
  }
}

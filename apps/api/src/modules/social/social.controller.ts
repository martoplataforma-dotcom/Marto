// apps/api/src/modules/social/social.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { SocialService } from './social.service';

function getUserId(req: Request): string {
  const u = (req as any).user as
    | { userId?: string; sub?: string; id?: string }
    | undefined;

  const id = u?.userId ?? u?.sub ?? u?.id;
  if (!id) throw new Error('userId ausente no token');
  return String(id);
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

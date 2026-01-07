import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SocialService } from './social.service';

type CreateSocialPostBody = {
  userId: string;
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

  @Post('posts')
  createPost(@Body() body: CreateSocialPostBody): Promise<unknown> {
    return this.service.createPost(body);
  }

  @Get('products/:productId/posts')
  listByProduct(@Param('productId') productId: string): Promise<unknown> {
    return this.service.listByProduct(productId);
  }

  @Post('posts/:postId/delete')
  deletePost(
    @Param('postId') postId: string,
    @Body() body: { userId: string },
  ): Promise<unknown> {
    return this.service.deletePost(postId, body.userId);
  }

  @Post('posts/:postId/update')
  updatePost(
    @Param('postId') postId: string,
    @Body() body: { userId: string; caption?: string },
  ): Promise<unknown> {
    return this.service.updatePost(postId, body.userId, {
      caption: body.caption,
    });
  }
}

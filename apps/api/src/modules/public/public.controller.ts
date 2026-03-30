import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('products/:id/shipping-options')
  async getProductShippingOptions(@Param('id') id: string) {
    return this.publicService.getProductShippingOptions(id);
  }

  @Get('users/:handle')
  async getPublicUser(@Param('handle') handle: string) {
    const data = await this.publicService.getPublicUserByHandle(handle);
    if (!data) throw new NotFoundException('Usuário não encontrado');
    return data;
  }
}

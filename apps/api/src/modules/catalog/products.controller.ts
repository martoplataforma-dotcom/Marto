import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { RolesGuard } from '../identity/roles/roles.guard';
import { Roles } from '../identity/roles/roles.decorator';
import { Role } from '../identity/roles/role.enum';

@Controller('products')
export class ProductsController {
  @Get()
  list() {
    return [
      {
        id: 'prod-1',
        name: 'Produto teste',
        price: 100,
      },
    ];
  }

  // ✅ ADICIONADO: GET /api/products/:id (pra checkout funcionar)
  @Get(':id')
  getById(@Param('id') id: string) {
    // Mantém o mock atual
    if (id === 'prod-1') {
      return {
        id: 'prod-1',
        name: 'Produto teste',
        price: 100,
      };
    }

    // Se não achar, retorna null (front vai tratar como erro depois)
    // Se você quiser, depois trocamos pra NotFoundException.
    return null;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return {
      id: `prod-${Date.now()}`,
      name: dto.name,
      price: dto.price,
      description: dto.description ?? null,
      createdAt: new Date().toISOString(),
    };
  }
}

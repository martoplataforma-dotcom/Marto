import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request } from 'express';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';

import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { ProductsService } from './products.service';

function getUserId(req: Request): string {
  const u = req.user as { id?: string; sub?: string } | undefined;
  return String(u?.id ?? u?.sub ?? '');
}

@Controller('merchants/me/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /**
   * 🔎 GET /api/merchants/me/products
   * Lista os produtos do lojista logado
   */
  @Get()
  async list(@Req() req: Request) {
    const userId = getUserId(req);
    return this.service.listByUserId(userId);
  }

  /**
   * ➕ POST /api/merchants/me/products
   * Cria um produto para o lojista logado
   */
  @Post()
  async create(
    @Req() req: Request,
    @Body()
    body: {
      title: string;
      description?: string | null;
      priceCents: number;
      images?: string[] | null;
      imageCaptions?: string[] | null;
      meta?: Prisma.InputJsonValue | null;
    },
  ) {
    const userId = getUserId(req);
    return this.service.createByUserId(userId, body);
  }

  /**
   * ✅ PUT /api/merchants/me/products/:id
   * Atualiza um produto do lojista
   */
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      active?: boolean;
      title?: string;
      description?: string | null;
      priceCents?: number;
      images?: string[] | null;
      imageCaptions?: string[] | null;
      meta?: Prisma.InputJsonValue | null;
    },
  ) {
    const userId = getUserId(req);
    return this.service.updateByUserId(userId, String(id), body);
  }

  /**
   * 🖼️ POST /api/merchants/me/products/:id/images
   * Upload de 1 imagem (field: file) e salva URL em Product.images
   */
  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const productId = String(req.params?.id ?? '').trim();

          // mesma lógica do main.ts (monorepo)
          const uploadsFromCwd = path.resolve(process.cwd(), 'uploads');
          const uploadsFromAppsApi = path.resolve(
            process.cwd(),
            '..',
            '..',
            'uploads',
          );

          const uploadsDir = fs.existsSync(uploadsFromCwd)
            ? uploadsFromCwd
            : uploadsFromAppsApi;

          const dest = path.resolve(uploadsDir, 'products', productId);

          try {
            fs.mkdirSync(dest, { recursive: true });
            cb(null, dest);
          } catch {
            cb(new Error('Não foi possível criar a pasta de upload.'), dest);
          }
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname || '').toLowerCase();
          const safeExt = ext && ext.length <= 10 ? ext : '';
          const name = `img-${Date.now()}${safeExt}`;
          cb(null, name);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ok = String(file.mimetype || '').startsWith('image/');
        cb(ok ? null : new Error('Arquivo deve ser uma imagem.'), ok);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadImage(
    @Req() req: Request,
    @Param('id') id: string,
    @UploadedFile() file?: { filename?: string },
  ) {
    const userId = getUserId(req);

    if (!file?.filename) {
      return { ok: false, message: 'Nenhuma imagem enviada (field "file").' };
    }

    // URL pública (servida pelo static /uploads)
    const imageUrl = `/uploads/products/${id}/${file.filename}`;

    return this.service.addImageByUserId(userId, String(id), imageUrl);
  }
}

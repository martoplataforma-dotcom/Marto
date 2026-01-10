// apps/api/src/common/uploads/uploads.controller.ts
import * as fs from 'fs';
import * as path from 'path';

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

function resolveUploadsDir(): string {
  const uploadsFromCwd = path.resolve(process.cwd(), 'uploads');
  const uploadsFromAppsApi = path.resolve(process.cwd(), '..', '..', 'uploads');
  return fs.existsSync(uploadsFromCwd) ? uploadsFromCwd : uploadsFromAppsApi;
}

function safeBaseName(name: string): string {
  // remove caracteres estranhos, mantém letras/números/._-
  return String(name || 'file')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

@Controller('uploads') // com prefixo global vira /api/uploads
export class UploadsController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = resolveUploadsDir();
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname || '').toLowerCase();
          const base = safeBaseName(
            path.basename(file.originalname || 'file', ext),
          );
          const stamp = Date.now();
          cb(null, `${base}-${stamp}${ext || ''}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
      fileFilter: (req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
        cb(ok ? null : new BadRequestException('Arquivo deve ser imagem.'), ok);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.filename) {
      throw new BadRequestException('Envie um arquivo no campo "file".');
    }

    // o main.ts já expõe /uploads fora do /api
    const publicUrl = `http://localhost:${process.env.PORT || 3001}/uploads/${file.filename}`;

    return {
      ok: true,
      filename: file.filename,
      url: publicUrl,
    };
  }
}

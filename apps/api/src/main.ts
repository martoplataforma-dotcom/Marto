// apps/api/src/main.ts
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

// 1) Tenta carregar .env da raiz do monorepo (Marto/.env) usando cwd (mais robusto)
const rootEnvPath = path.resolve(process.cwd(), '.env');

// 2) Fallback: .env local do app (apps/api/.env)
const localEnvPath = path.resolve(process.cwd(), 'apps/api/.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

// 3) Se AINDA assim não tiver DATABASE_URL, força em dev e bloqueia em production
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL ausente em production');
  }

  process.env.DATABASE_URL =
    'postgresql://marto:marto@127.0.0.1:5432/marto?schema=public';
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  const env = process.env.NODE_ENV || 'development';

  Logger.log(`🚀 API rodando em http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`🌱 Ambiente: ${env}`, 'Bootstrap');
}

void bootstrap();

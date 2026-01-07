import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerModule);
  // eslint-disable-next-line no-console
  console.log('🧵 Marto Worker iniciado');
}

void bootstrap();

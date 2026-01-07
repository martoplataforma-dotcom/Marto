import { Module, OnModuleInit } from '@nestjs/common';
import { startOutboxWorker } from './processors/outbox.processor';

@Module({})
export class WorkerModule implements OnModuleInit {
  onModuleInit() {
    startOutboxWorker();
  }
}
